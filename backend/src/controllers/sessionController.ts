import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { Op } from 'sequelize';
import {
    Session,
    Schedule,
    TeacherAttendance,
    StudentAttendance,
    Class,
    Teacher,
    User,
    Student,
    Geofence,
    TeacherWorkingHours,
    Subject
} from '../models';
import sequelize from '../config/database';
import { calculateDistance } from '../utils/geofence';
import { getIO } from '../socket';
import { sessionManager } from '../services/SessionManager';

import { getJakartaNow } from '../utils/date';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/check-in
// Teacher scans Class QR to start a session
// ─────────────────────────────────────────────────────────────────────────────
export const checkInSession = async (req: AuthRequest, res: Response): Promise<void> => {
    const t = await sequelize.transaction();
    try {
        const { qrData, lat, lng } = req.body;
        const userId = req.user?.id;

        if (!userId || !qrData) {
            await t.rollback();
            res.status(400).json({ error: 'Data tidak lengkap (QR/User)' });
            return;
        }

        // 1. Validate Geolocation (Optional but recommended)
        if (lat && lng) {
            const geofence = await Geofence.findOne({ where: { isActive: true } });
            if (geofence) {
                const dist = calculateDistance(lat, lng, Number(geofence.latitude), Number(geofence.longitude));
                if (dist > geofence.radiusMeters) {
                    await t.rollback();
                    res.status(400).json({ error: `Di luar jangkauan (${Math.round(dist)}m)` });
                    return;
                }
            }
        }

        // 2. Parse and Validate QR
        let parsedQR;
        try {
            parsedQR = JSON.parse(qrData);
        } catch {
            await t.rollback();
            res.status(400).json({ error: 'QR Code tidak valid formatnya' });
            return;
        }

        if (parsedQR.type !== 'class-session' || !parsedQR.id || !parsedQR.token) {
            await t.rollback();
            res.status(400).json({ error: 'QR Code bukan untuk sesi kelas' });
            return;
        }

        const cls = await Class.findByPk(parsedQR.id);
        if (!cls) {
            await t.rollback();
            res.status(404).json({ error: 'Kelas tidak ditemukan' });
            return;
        }

        // Verify Token
        if (cls.qrCodeData !== parsedQR.token) {
            await t.rollback();
            res.status(400).json({ error: 'QR Code tidak valid / sudah kadaluarsa. Minta admin generate ulang.' });
            return;
        }

        // 3. Identification
        const teacher = await Teacher.findOne({ where: { userId } });
        if (!teacher) {
            await t.rollback();
            res.status(403).json({ error: 'Anda bukan guru terdaftar' });
            return;
        }

        // 3.5 SINGLE SOURCE OF TRUTH: Check for existing active session
        // A teacher can only have ONE active session at a time
        const activeSession = await sessionManager.hasActiveSession(teacher.id);
        if (activeSession) {
            await t.rollback();
            res.status(409).json({
                error: 'Anda sudah memiliki sesi aktif',
                code: 'SESSION_CONFLICT',
                activeSession: {
                    sessionId: activeSession.sessionId,
                    className: activeSession.className,
                    subjectName: activeSession.subjectName,
                    startTime: activeSession.startTime,
                    date: activeSession.date
                },
                message: `Selesaikan sesi ${activeSession.className} - ${activeSession.subjectName} sebelum memulai sesi baru.`
            });
            return;
        }

        // 4. Find Schedule (Owner) OR Session (Substitute)
        const now = getJakartaNow();
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

        // A. Try finding active schedule as Owner
        // A. Try finding ALL active schedules as Owner
        const schedules = await Schedule.findAll({
            where: {
                classId: cls.id,
                teacherId: teacher.id,
                dayOfWeek: dayOfWeek,
                isActive: true,
            },
            include: [{ model: Class, as: 'class' }, { model: Teacher, as: 'teacher' }],
            order: [['startTime', 'ASC']]
        });

        let schedule: any = null;
        let preExistingSession: any = null;

        // Helper to check if schedule is valid for now
        const isScheduleValidForNow = async (sched: any) => {
            const sStart = new Date(`${dateStr}T${sched.startTime}`);
            const tenMinBefore = new Date(sStart.getTime() - 10 * 60000);
            // Too early?
            if (now < tenMinBefore) return { valid: false, reason: 'too_early', time: tenMinBefore };

            // Check if session exists and is completed
            const sess = await Session.findOne({ where: { scheduleId: sched.id, date: dateStr }, transaction: t });
            if (sess && sess.status === 'completed') return { valid: false, reason: 'completed' };

            return { valid: true, session: sess };
        };

        // Iterate through schedules to find the best match
        for (const sched of schedules) {
            const check = await isScheduleValidForNow(sched);
            if (check.valid) {
                schedule = sched;
                preExistingSession = check.session;
                break; // Found a valid one!
            }
        }

        // B. If not owner (or no valid owner schedule found), check if assigned as Substitute
        if (!schedule) {
            preExistingSession = await Session.findOne({
                where: {
                    date: dateStr,
                    substituteTeacherId: teacher.id,
                    // Ensure the session belongs to the scanned class
                },
                include: [
                    {
                        model: Schedule,
                        as: 'schedule',
                        where: { classId: cls.id },
                        include: [{ model: Class, as: 'class' }, { model: Teacher, as: 'teacher' }]
                    }
                ],
                transaction: t
            });

            if (preExistingSession) {
                // Verify if substitute session is completed?
                if (preExistingSession.status !== 'completed') {
                    schedule = (preExistingSession as any).schedule;
                }
            }
        }

        if (!schedule) {
            console.log('❌ Check-in Failed: No valid schedule found for:', { classId: cls.id, teacherId: teacher.id, dayOfWeek, dateStr });
            await t.rollback();
            res.status(400).json({ error: 'Tidak ada jadwal aktif atau tugas pengganti yang bisa di-check-in saat ini (Mungkin terlalu cepat atau sudah selesai).' });
            return;
        }

        // Optional: Time Window Check (Already done in selection logic, but good to keep for substitute or safety)
        const selectedStartOb = new Date(`${dateStr}T${schedule.startTime}`);
        const selectedTenMinBefore = new Date(selectedStartOb.getTime() - 10 * 60000);

        if (now < selectedTenMinBefore) {
            const diffM = Math.ceil((selectedTenMinBefore.getTime() - now.getTime()) / 60000);
            console.log(`❌ Check-in Failed: Too early. Now: ${now}, Allowed: ${selectedTenMinBefore}`);
            await t.rollback();
            res.status(400).json({ error: `Check-in terlalu cepat. Tunggu ${diffM} menit lagi.` });
            return;
        }

        // Optional: Time Window Check (e.g. ±30 mins from start)
        const startOb = new Date(`${dateStr}T${schedule.startTime}`);
        const tenMinBefore = new Date(startOb.getTime() - 10 * 60000);

        if (now < tenMinBefore) {
            const diffM = Math.ceil((tenMinBefore.getTime() - now.getTime()) / 60000);
            console.log(`❌ Check-in Failed: Too early. Now: ${now}, Allowed: ${tenMinBefore}`);
            await t.rollback();
            res.status(400).json({ error: `Check-in terlalu cepat. Tunggu ${diffM} menit lagi.` });
            return;
        }

        // 5. Find or Create Session
        let session = preExistingSession;

        if (!session) {
            // Check if session already exists for this schedule today (if we are owner)
            session = await Session.findOne({
                where: { scheduleId: schedule.id, date: dateStr },
                transaction: t
            });
        }

        if (!session) {
            // Create new session
            session = await Session.create({
                scheduleId: schedule.id,
                date: dateStr,
                startTime: timeStr,
                status: 'ongoing',
            }, { transaction: t });
        } else {
            // If already completed?
            if (session.status === 'completed') {
                await t.rollback();
                res.status(400).json({ error: 'Sesi ini sudah selesai (completed).' });
                return;
            }
            // If exists but not ongoing, update it
            if (session.status !== 'ongoing') {
                await session.update({ status: 'ongoing', startTime: timeStr }, { transaction: t });
            }
        }

        // 6. Create Teacher Attendance (Session-based)
        const existingAtt = await TeacherAttendance.findOne({
            where: { teacherId: teacher.id, sessionId: session.id },
            transaction: t
        });

        if (existingAtt) {
            if (existingAtt.checkOutTime) {
                await t.rollback();
                res.status(400).json({ error: 'Anda sudah menyelesaikan sesi ini (Check-out tercatat).' });
                return;
            }
            // If exists but no checkOutTime, it's a re-scan during active session -> Allowed (idempotent)
        } else {
            await TeacherAttendance.create({
                teacherId: teacher.id,
                sessionId: session.id,
                date: dateStr,
                checkInTime: timeStr,
                status: 'present', // You might calculate 'late' here based on schedule.startTime
                latitude: lat,
                longitude: lng,
            }, { transaction: t });
        }

        // 7. Fetch Students for Frontend
        const students = await Student.findAll({
            where: { classId: cls.id },
            attributes: ['id', 'nis', 'name', 'gender'],
            order: [['name', 'ASC']],
            transaction: t
        });

        await t.commit();

        // Emit socket event
        try {
            const io = getIO();
            const sessionsNamespace = io.of('/sessions');

            // 1. Notify specific session room (for anyone watching this session)
            sessionsNamespace.to(`session-${session.id}`).emit('session:status-changed', {
                sessionId: session.id,
                status: session.status,
                teacherId: teacher.id,
                hasCheckIn: true,
                timestamp: new Date()
            });

            // 2. Notify global room (for admin dashboard etc)
            io.emit('teacher:checkin', {
                sessionId: session.id,
                teacherId: teacher.id,
                teacherName: (req.user as any)?.name,
                className: cls.name,
                timestamp: new Date()
            });
        } catch (e) {
            console.error('Socket emit failed:', e);
        }

        res.json({
            message: 'Check-in berhasil. Sesi dimulai.',
            session: {
                id: session.id,
                classId: cls.id,
                className: cls.name,
                startTime: session.startTime,
                status: session.status
            },
            students
        });

    } catch (error) {
        await t.rollback();
        console.error('Session Check-in Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/:id/student-attendance
// Bulk save student attendance
// Body: { statuses: [{ studentId: 1, status: 'hadir' }, ...] }
// ─────────────────────────────────────────────────────────────────────────────
export const saveStudentAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params; // sessionId
        const { statuses } = req.body; // Array of { studentId, status }

        if (!statuses || !Array.isArray(statuses)) {
            await t.rollback();
            res.status(400).json({ error: 'Invalid data format' });
            return;
        }

        const session = await Session.findByPk(Number(id));
        if (!session) {
            await t.rollback();
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        // Verify ownership? (Optional: check if req.user is the teacher of this session)

        // Bulk Upsert Logic
        // We iterate and upsert. Sequelize bulkCreate with updateOnDuplicate is option, 
        // but simple loop is safer for logic control.
        const userId = req.user?.id;

        for (const item of statuses) {
            const { studentId, status } = item;

            // Check existing
            const existing = await StudentAttendance.findOne({
                where: { sessionId: session.id, studentId },
                transaction: t
            });

            if (existing) {
                await existing.update({
                    status,
                    markedBy: userId,
                    markedAt: new Date()
                }, { transaction: t });
            } else {
                await StudentAttendance.create({
                    sessionId: session.id,
                    studentId,
                    status,
                    markedBy: userId,
                    markedAt: new Date()
                }, { transaction: t });
            }
        }

        await t.commit();
        res.json({ message: 'Absensi siswa berhasil disimpan' });

    } catch (error) {
        await t.rollback();
        console.error('Save Student Attendance Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/:id/check-out
// End the session with optional early checkout reason
// ─────────────────────────────────────────────────────────────────────────────
export const checkOutSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { earlyCheckoutReason } = req.body; // Optional: reason for early checkout
        const userId = req.user?.id;

        const session = await Session.findByPk(Number(id), {
            include: [{ model: Schedule, as: 'schedule' }]
        });

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        // Verify teacher
        const teacher = await Teacher.findOne({ where: { userId } });
        if (!teacher) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const now = getJakartaNow();
        const nowTime = now.toTimeString().split(' ')[0];

        // Get schedule info
        const sessAny = session as any;
        const schedule = sessAny.schedule;

        if (!schedule) {
            res.status(400).json({ error: 'Schedule data not found for this session' });
            return;
        }

        // Use session's actual date for calculations, not today
        const sessionDate = new Date(session.date);
        const sessionDateStr = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, '0')}-${String(sessionDate.getDate()).padStart(2, '0')}`;
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const isStaleSession = sessionDateStr !== todayStr;

        // Calculate session times
        const plannedStart = session.startTime || schedule.startTime;
        const plannedEnd = session.endTime || schedule.endTime;

        const startOb = new Date(`${sessionDateStr}T${plannedStart}`);
        const endOb = new Date(`${sessionDateStr}T${plannedEnd}`);
        const tenMinBeforeEnd = new Date(endOb.getTime() - 10 * 60000);

        // Calculate elapsed and total duration
        const totalDurationMs = endOb.getTime() - startOb.getTime();
        const elapsedMs = now.getTime() - startOb.getTime();
        const elapsedPercent = Math.round((elapsedMs / totalDurationMs) * 100);
        const elapsedMinutes = Math.round(elapsedMs / 60000);
        const totalMinutes = Math.round(totalDurationMs / 60000);

        // Determine if this is an early checkout (before 10 min of end time)
        const isEarlyCheckout = now < tenMinBeforeEnd;

        // If session is from a PREVIOUS day, allow immediate checkout (it's overdue)
        if (isStaleSession) {
            console.log(`[AUTO-CLOSE] Stale session ${session.id} from ${sessionDateStr} being closed on ${todayStr}`);
            // Skip all early checkout checks — just close it
        } else {
            // STRICT RULE: Minimum 80% of session duration must pass before ANY checkout
            const MIN_CHECKOUT_PERCENT = 80;

            if (elapsedPercent < MIN_CHECKOUT_PERCENT) {
                const remainingForMinimum = Math.ceil((totalDurationMs * (MIN_CHECKOUT_PERCENT / 100) - elapsedMs) / 60000);
                const minMinutesRequired = Math.ceil(totalMinutes * MIN_CHECKOUT_PERCENT / 100);

                // If very early (< 50%), reject completely
                if (elapsedPercent < 50) {
                    res.status(400).json({
                        error: `Checkout belum diizinkan. Sesi baru berjalan ${elapsedPercent}% (${elapsedMinutes}/${totalMinutes} menit). Minimal ${MIN_CHECKOUT_PERCENT}% durasi sesi harus terlewati.`,
                        earlyCheckout: true,
                        requiresReason: false,
                        canCheckout: false,
                        elapsedPercent,
                        elapsedMinutes,
                        totalMinutes,
                        minPercent: MIN_CHECKOUT_PERCENT,
                        minutesRemaining: remainingForMinimum,
                        minMinutesRequired
                    });
                    return;
                }

                // Between 50-80%: Allow with mandatory reason
                if (!earlyCheckoutReason || earlyCheckoutReason.trim() === '') {
                    res.status(400).json({
                        error: `Check-out awal memerlukan alasan. Sesi baru berjalan ${elapsedPercent}% (${elapsedMinutes}/${totalMinutes} menit). Checkout normal tersedia setelah ${MIN_CHECKOUT_PERCENT}% durasi.`,
                        earlyCheckout: true,
                        requiresReason: true,
                        canCheckout: true,
                        elapsedPercent,
                        elapsedMinutes,
                        totalMinutes,
                        minPercent: MIN_CHECKOUT_PERCENT,
                        minutesUntilNormalCheckout: remainingForMinimum,
                        availableReasons: [
                            { value: 'class_cancelled', label: 'Kelas dibatalkan' },
                            { value: 'students_absent', label: 'Siswa tidak hadir' },
                            { value: 'emergency', label: 'Kondisi darurat' },
                            { value: 'schedule_conflict', label: 'Konflik jadwal' },
                            { value: 'material_completed', label: 'Materi selesai lebih awal' },
                            { value: 'other', label: 'Lainnya' }
                        ]
                    });
                    return;
                }
            }
        }

        const endTime = nowTime;

        // Update Session
        await session.update({
            status: 'completed',
            endTime: endTime
        });

        // Update Teacher Attendance with checkout details
        const updateData: any = {
            checkOutTime: endTime,
        };

        // Record reason/notes for audit
        if (isStaleSession) {
            updateData.notes = `[AUTO-CLOSE] Stale session from ${sessionDateStr}, closed on ${todayStr}`;
        } else if (isEarlyCheckout) {
            updateData.notes = `[EARLY CHECKOUT] Reason: ${earlyCheckoutReason} | Elapsed: ${elapsedMinutes}/${totalMinutes} min (${elapsedPercent}%)`;
        }

        await TeacherAttendance.update(
            updateData,
            { where: { sessionId: session.id, teacherId: teacher.id } }
        );

        // Log early checkouts for audit
        if (isEarlyCheckout) {
            console.log(`[AUDIT] Early Checkout - Teacher: ${teacher.id}, Session: ${session.id}, Reason: ${earlyCheckoutReason}, Elapsed: ${elapsedPercent}%`);
        }

        // Emit event
        try {
            const io = getIO();
            const sessionsNamespace = io.of('/sessions');

            sessionsNamespace.to(`session-${session.id}`).emit('session:status-changed', {
                sessionId: session.id,
                status: 'completed',
                checkOutTime: endTime,
                hasCheckIn: true,
                isEarlyCheckout,
                earlyCheckoutReason: isEarlyCheckout ? earlyCheckoutReason : null,
                timestamp: new Date()
            });

            io.emit('teacher:checkout', {
                sessionId: session.id,
                teacherId: teacher.id,
                isEarlyCheckout,
                timestamp: new Date()
            });
        } catch (e) {
            console.error('Socket emit check-out failed:', e);
        }

        res.json({
            message: isEarlyCheckout ? 'Sesi diakhiri lebih awal' : 'Sesi selesai',
            endTime,
            isEarlyCheckout,
            elapsedPercent,
            elapsedMinutes,
            totalMinutes
        });

    } catch (error) {
        console.error('Check-out Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sessions/my-active
// Check if teacher has any ongoing session (for resuming state)
// ─────────────────────────────────────────────────────────────────────────────
export const getMyActiveSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const teacher = await Teacher.findOne({ where: { userId } });

        if (!teacher) {
            res.json(null);
            return;
        }

        // Find session where teacher is participant (attendance) AND session is ongoing
        // NOTE: Do NOT filter by date — stale sessions from previous days must also be found
        const activeAtt = await TeacherAttendance.findOne({
            where: {
                teacherId: teacher.id,
                checkOutTime: null as any, // Not checked out
                sessionId: { [Op.ne]: null as any } // Is a session
            },
            include: [{
                model: Session,
                as: 'session',
                where: { status: 'ongoing' },
                include: [
                    {
                        model: Schedule,
                        as: 'schedule',
                        include: [
                            { model: Class, as: 'class' },
                            { model: Subject, as: 'subject' }
                        ]
                    }
                ]
            }],
            order: [['createdAt', 'DESC']]
        });

        if (!activeAtt || !activeAtt.session) {
            res.json(null);
            return;
        }

        const sess = activeAtt.session as any; // Cast to access included props
        res.json({
            id: sess.id,
            startTime: sess.startTime,
            class: sess.schedule?.class,
            subject: sess.schedule?.subject,
            status: sess.status
        });

    } catch (error) {
        console.error('Get My Active Session Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sessions/my-current
// Get current session status + fast forward to next if completed
// ─────────────────────────────────────────────────────────────────────────────
// Helper to get teacher's agenda for a specific date
const getTeacherAgenda = async (teacherId: number, date: Date) => {
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    // 1. Find ALL schedules for this day
    const schedules = await Schedule.findAll({
        where: {
            teacherId,
            dayOfWeek,
            isActive: true
        },
        include: [
            { model: Class, as: 'class', attributes: ['id', 'name'] },
            { model: Subject, as: 'subject', attributes: ['id', 'name'] }
        ],
        order: [['startTime', 'ASC']]
    });

    // 2. Find Substitute Sessions for this day
    const subSessions = await Session.findAll({
        where: {
            substituteTeacherId: teacherId,
            date: dateStr
        },
        include: [
            {
                model: Schedule,
                as: 'schedule',
                include: [
                    { model: Class, as: 'class', attributes: ['id', 'name'] },
                    { model: Subject, as: 'subject', attributes: ['id', 'name'] }
                ]
            }
        ]
    });

    // 3. Combine into Agenda
    let agenda = schedules.map(s => {
        const sAny = s as any;
        return {
            type: 'regular',
            id: s.id, // scheduleId
            startTime: s.startTime,
            endTime: s.endTime,
            className: sAny.class?.name,
            subjectName: sAny.subject?.name,
            scheduleId: s.id,
            classId: s.classId,
            isSubstitute: false
        };
    });

    subSessions.forEach(s => {
        const sAny = s as any;
        agenda.push({
            type: 'substitute',
            id: s.id, // sessionId
            startTime: s.startTime as string,
            endTime: s.endTime as string,
            className: sAny.schedule?.class?.name,
            subjectName: sAny.schedule?.subject?.name,
            scheduleId: s.scheduleId,
            classId: sAny.schedule?.classId,
            isSubstitute: true
        });
    });

    // Sort by start time
    agenda.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return agenda;
};

export const getMyCurrentSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const teacher = await Teacher.findOne({ where: { userId } });

        if (!teacher) {
            res.status(404).json({ error: 'Teacher not found' });
            return;
        }

        const now = getJakartaNow();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // A. Check for ACTIVE session (Checked In but NOT Checked Out)
        // This takes precedence over everything.
        // NOTE: Do NOT filter by date — stale sessions from previous days must also be detected
        const activeAtt = await TeacherAttendance.findOne({
            where: {
                teacherId: teacher.id,
                checkOutTime: null as any,
                sessionId: { [Op.ne]: null as any }
            },
            include: [{
                model: Session,
                as: 'session',
                where: { status: 'ongoing' },
                include: [
                    {
                        model: Schedule,
                        as: 'schedule',
                        include: [
                            { model: Class, as: 'class' },
                            { model: Subject, as: 'subject' }
                        ]
                    }
                ]
            }]
        });

        if (activeAtt && activeAtt.session) {
            // Found active session
            const sess = activeAtt.session as any;
            const sched = sess.schedule;

            // Calculate check-out window
            // Use session's actual date for time calculations
            const sessDate = new Date(sess.date);
            const sessDateStr = `${sessDate.getFullYear()}-${String(sessDate.getMonth() + 1).padStart(2, '0')}-${String(sessDate.getDate()).padStart(2, '0')}`;
            const isStale = sessDateStr !== todayStr;

            const plannedEnd = sess.endTime || sched?.endTime || '23:59:59';
            const endT = new Date(`${sessDateStr}T${plannedEnd}`);
            const tenMinMs = 10 * 60 * 1000;
            const nowTime = now.getTime();

            // If session is from a previous day, always allow checkout
            const minutesUntilCheckOut = isStale ? -1 : Math.ceil((endT.getTime() - tenMinMs - nowTime) / 60000);
            const canCheckOut = minutesUntilCheckOut <= 0;

            // Calculate schedule times for frontend timer
            const scheduleStart = sched?.startTime || sess.startTime;
            const scheduleEnd = sched?.endTime || plannedEnd;
            const startT = new Date(`${todayStr}T${scheduleStart}`);
            const durationMinutes = Math.round((endT.getTime() - startT.getTime()) / 60000);

            res.json({
                currentSession: {
                    id: sess.id,
                    scheduleId: sess.scheduleId,
                    classId: sched?.classId,
                    className: sched?.class?.name,
                    subjectName: sched?.subject?.name,
                    startTime: sess.startTime, // Actual check-in time
                    endTime: plannedEnd, // Planned end time
                    // NEW: Schedule times for accurate timer calculation
                    scheduleStartTime: scheduleStart,
                    scheduleEndTime: scheduleEnd,
                    durationMinutes,
                    status: 'active',
                    hasCheckIn: true,
                    canCheckIn: false,
                    canCheckOut,
                    minutesUntilCheckIn: 0,
                    minutesUntilCheckOut,
                    isSubstitute: sess.substituteTeacherId === teacher.id,
                    nextSessionId: null
                }
            });
            return;
        }

        // B. No active session. Find NEXT session.
        // 1. Look at TODAY
        const todayAgenda = await getTeacherAgenda(teacher.id, now);
        let targetItem = null;
        let sessionData = null;
        let targetDateStr = todayStr;

        // Filter today's agenda for upcoming/ongoing items
        for (const item of todayAgenda) {
            const sess = await Session.findOne({
                where: { scheduleId: item.scheduleId, date: todayStr }
            });

            // Skip if completed
            if (sess && sess.status === 'completed') continue;

            // Skip if time passed (endTime < now) AND not ongoing
            // If it's ongoing (status='ongoing') but teacher hasn't checked in -> technically possible if someone else started it? 
            // Or if system marked it? But we checked activeAtt above.
            // Let's rely on time.
            const endT = new Date(`${todayStr}T${item.endTime}`);
            if (now > endT) continue; // Session ended

            // Found candidate (either future, or currently likely running but not checked in)
            targetItem = item;
            sessionData = sess;
            break;
        }

        // 2. If nothing today, look at TOMORROW
        if (!targetItem) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            const tomorrowAgenda = await getTeacherAgenda(teacher.id, tomorrow);

            if (tomorrowAgenda.length > 0) {
                targetItem = tomorrowAgenda[0]; // First one tomorrow
                targetDateStr = tomorrowStr;
                // sessionData is null for tomorrow typically
                const sess = await Session.findOne({
                    where: { scheduleId: targetItem.scheduleId, date: tomorrowStr }
                });
                sessionData = sess;
            }
        }

        if (!targetItem) {
            res.json({ currentSession: null, message: "No upcoming sessions found." });
            return;
        }

        // C. Calculate Timing for Target
        const startT = new Date(`${targetDateStr}T${targetItem.startTime}`);
        const endT = new Date(`${targetDateStr}T${targetItem.endTime}`);
        const nowTime = now.getTime();
        const tenMinMs = 10 * 60 * 1000;

        const minutesUntilCheckIn = Math.ceil((startT.getTime() - tenMinMs - nowTime) / 60000);

        // Can check in if: window open (minutes <= 0) AND (today OR (tomorrow logic?! No, check-in only allowed 10 mins before))
        // If target is tomorrow, minutesUntilCheckIn will be large positive.

        const canCheckIn = minutesUntilCheckIn <= 0; // && !attendanceData (implied by reaching here)

        let status = 'scheduled';
        if (sessionData?.status === 'ongoing') status = 'ongoing';

        res.json({
            currentSession: {
                id: sessionData ? sessionData.id : targetItem.id,
                scheduleId: targetItem.scheduleId,
                classId: targetItem.classId,
                className: targetItem.className,
                subjectName: targetItem.subjectName,
                startTime: targetItem.startTime,
                endTime: targetItem.endTime,
                status,
                hasCheckIn: false,
                canCheckIn,
                canCheckOut: false,
                minutesUntilCheckIn,
                minutesUntilCheckOut: 0,
                isSubstitute: targetItem.isSubstitute,
                nextSessionId: null
            }
        });

    } catch (error) {
        console.error('Get My Current Session Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

