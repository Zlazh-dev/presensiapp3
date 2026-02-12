import { Request, Response } from 'express';
import path from 'path';
import { getJakartaToday, getJakartaTime } from '../utils/date';
import { Op } from 'sequelize';
import { TeacherAttendance, StudentAttendance, User, Student, Teacher, Class, HolidayEvent, Geofence, TeacherWorkingHours, Session, Schedule } from '../models';
import { AuthRequest } from '../middlewares/auth';
import { calculateDistance } from '../utils/geofence';


/**
 * Scan attendance with geofence validation
 * POST /api/attendance/scan
 */
export const scanAttendance = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { userId, userType, latitude, longitude } = req.body;

        // Validate required fields
        if (!userId || !userType || latitude === undefined || longitude === undefined) {
            res.status(400).json({ error: 'userId, userType, latitude, and longitude are required' });
            return;
        }

        // Validate geofence from DB
        const geofence = await Geofence.findOne({ where: { isActive: true } });
        if (geofence) {
            const distance = calculateDistance(
                latitude, longitude,
                Number(geofence.latitude), Number(geofence.longitude)
            );
            if (distance > geofence.radiusMeters) {
                res.status(400).json({
                    error: `Di luar area geofence (${Math.round(distance)}m dari ${geofence.label}, max ${geofence.radiusMeters}m)`,
                    distance: Math.round(distance),
                    radiusMeters: geofence.radiusMeters,
                });
                return;
            }
        }

        const today = getJakartaToday();
        const currentTime = getJakartaTime();

        // ── Holiday check ──
        const holidayWhere: any = {
            date: today,
            isActive: true,
            [Op.or]: [{ classId: null }],   // school-wide always checked
        };

        const holidays = await HolidayEvent.findAll({ where: holidayWhere });
        if (holidays.length > 0) {
            const reasons = holidays.map(h => (h as any).reason).join(', ');
            res.status(200).json({
                valid: false,
                message: `Libur: ${reasons}`,
                holidays: holidays.map(h => ({
                    date: (h as any).date,
                    reason: (h as any).reason,
                    type: (h as any).type,
                })),
            });
            return;
        }

        if (userType === 'teacher') {
            // Find teacher by userId
            const teacher = await Teacher.findOne({ where: { userId } });
            if (!teacher) {
                res.status(404).json({ error: 'Teacher not found' });
                return;
            }

            // Check for duplicate attendance today
            const existingAttendance = await TeacherAttendance.findOne({
                where: {
                    teacherId: teacher.id,
                    date: today
                }
            });

            if (existingAttendance) {
                res.status(400).json({ error: 'Attendance already recorded for today' });
                return;
            }

            // Create attendance record
            const attendance = await TeacherAttendance.create({
                teacherId: teacher.id,
                date: today,
                status: 'present',
                checkInTime: currentTime,
                latitude,
                longitude
            });

            res.status(201).json({
                message: 'Attendance recorded successfully',
                attendance
            });

        } else if (userType === 'student') {
            // Find student by userId (if students have users) or by studentId
            const student = await Student.findByPk(userId);
            if (!student) {
                res.status(404).json({ error: 'Student not found' });
                return;
            }

            // For students, we would need a sessionId, but tests don't provide it
            res.status(400).json({ error: 'Student attendance requires sessionId' });
            return;

        } else {
            res.status(400).json({ error: 'Invalid userType. Must be "teacher" or "student"' });
            return;
        }

    } catch (error) {
        console.error('[POST /api/attendance/scan] Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
        });
    }
};

/**
 * Get attendance records by date
 * GET /api/attendance?date=YYYY-MM-DD
 */
export const getAttendanceByDate = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { date } = req.query;

        if (!date || typeof date !== 'string') {
            res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD format)' });
            return;
        }

        console.log(`[GET /api/attendance] Fetching attendance for date: ${date}`);

        // Get teacher attendance for the specific date
        const teacherAttendance = await TeacherAttendance.findAll({
            where: { date },
            include: [{
                model: Teacher,
                as: 'teacher',
                required: false,
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'username']
                }]
            }]
        });

        // For students, we need to get attendance by sessions on that date
        const studentAttendance: any[] = [];

        console.log(`[GET /api/attendance] Found ${teacherAttendance.length} teacher records, ${studentAttendance.length} student records`);

        // Combine both types into single attendance array
        const attendance = [...teacherAttendance, ...studentAttendance];

        res.json({
            attendance
        });
    } catch (error) {
        console.error('[GET /api/attendance] Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
        });
    }
};

/**
 * Record new teacher attendance
 * POST /api/attendance
 */
export const recordAttendance = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { userType, userId, teacherId, studentId, sessionId, date, status, checkInTime, checkOutTime, latitude, longitude, notes } = req.body;

        console.log(`[POST /api/attendance] Recording attendance:`, { userType, userId, teacherId, studentId, sessionId, date, status });

        let attendance;

        if (userType === 'teacher' || teacherId) {
            // Teacher attendance requires: teacherId, date, status
            const finalTeacherId = teacherId || userId;
            if (!finalTeacherId || !date || !status) {
                res.status(400).json({ error: 'teacherId, date, and status are required for teacher attendance' });
                return;
            }

            attendance = await TeacherAttendance.create({
                teacherId: finalTeacherId,
                date,
                status,
                checkInTime: checkInTime || null,
                checkOutTime: checkOutTime || null,
                latitude: latitude || null,
                longitude: longitude || null,
                notes: notes || null,
                sessionId: sessionId || null
            });

        } else if (userType === 'student' || studentId) {
            // Student attendance requires: studentId, sessionId, status
            const finalStudentId = studentId || userId;
            if (!finalStudentId || !sessionId || !status) {
                res.status(400).json({ error: 'studentId, sessionId, and status are required for student attendance' });
                return;
            }

            attendance = await StudentAttendance.create({
                studentId: finalStudentId,
                sessionId,
                status,
                markedAt: new Date(),
                markedBy: req.user?.id,
                notes: notes || undefined
            });

        } else {
            res.status(400).json({ error: 'Invalid userType. Must be "teacher" or "student", or provide teacherId/studentId' });
            return;
        }

        console.log(`[POST /api/attendance] Successfully recorded attendance`);
        res.status(201).json({ attendance });
    } catch (error) {
        console.error('[POST /api/attendance] Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-FILL ALPHA - Runs daily via cron to mark absent teachers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Auto-fill alpha for teachers who didn't record attendance
 * Checks both regular working hours AND class sessions
 * Skips holidays and weekends (Saturday/Sunday)
 */
export const autoFillAlpha = async (targetDate?: string): Promise<{ regularCreated: number; sessionCreated: number; skipped?: string }> => {
    // Default to yesterday
    const dateToProcess = targetDate || (() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    })();

    console.log(`🔄 Auto-filling alpha for ${dateToProcess}...`);

    let regularCreated = 0;
    let sessionCreated = 0;

    try {
        // Get day of week for the target date (1=Senin=Monday ... 7=Minggu=Sunday)
        const targetDateObj = new Date(dateToProcess);
        const jsDay = targetDateObj.getDay(); // 0=Sunday, 1=Monday ...
        const dayOfWeek = jsDay === 0 ? 7 : jsDay; // Convert to 1-7 format

        // === SKIP WEEKENDS ===
        if (dayOfWeek === 6 || dayOfWeek === 7) {
            console.log(`⏭️ Skipping alpha fill for weekend (dayOfWeek=${dayOfWeek})`);
            return { regularCreated: 0, sessionCreated: 0, skipped: 'Weekend' };
        }

        // === SKIP HOLIDAYS ===
        const holidays = await HolidayEvent.findAll({
            where: {
                date: dateToProcess,
                isActive: true,
            }
        });

        if (holidays.length > 0) {
            const reasons = holidays.map((h: any) => h.reason).join(', ');
            console.log(`⏭️ Skipping alpha fill for holiday: ${reasons}`);
            return { regularCreated: 0, sessionCreated: 0, skipped: `Libur: ${reasons}` };
        }

        // === PART 1: REGULAR WORKING HOURS ===
        console.log(`📋 Checking regular working hours for dayOfWeek=${dayOfWeek}...`);

        const workingHours = await TeacherWorkingHours.findAll({
            where: { dayOfWeek },
            include: [{
                model: Teacher,
                as: 'teacher',
                include: [{ model: User, as: 'user', attributes: ['name'] }]
            }]
        });

        console.log(`   Found ${workingHours.length} teachers scheduled to work on this day`);

        for (const wh of workingHours as any[]) {
            // Check if regular attendance record exists (no sessionId)
            const existing = await TeacherAttendance.findOne({
                where: {
                    teacherId: wh.teacherId,
                    date: dateToProcess,
                    sessionId: { [Op.is]: null as any } // Regular attendance has no session
                }
            });

            if (!existing) {
                await TeacherAttendance.create({
                    teacherId: wh.teacherId,
                    date: dateToProcess,
                    status: 'alpha',
                    checkInTime: undefined,
                    checkOutTime: undefined,
                    notes: 'Auto-generated: Tidak hadir tanpa keterangan'
                });
                console.log(`   ✅ Alpha created for ${wh.teacher?.user?.name || 'Unknown'} (regular)`);
                regularCreated++;
            }
        }

        // === PART 2: CLASS SESSIONS ===
        console.log(`📋 Checking class sessions for ${dateToProcess}...`);

        const sessions = await Session.findAll({
            where: {
                date: dateToProcess,
                status: { [Op.in]: ['scheduled', 'ongoing', 'completed'] }
            },
            include: [{
                model: Schedule,
                as: 'schedule',
                include: [{
                    model: Teacher,
                    as: 'teacher',
                    include: [{ model: User, as: 'user', attributes: ['name'] }]
                }]
            }]
        });

        console.log(`   Found ${sessions.length} sessions on this date`);

        for (const session of sessions as any[]) {
            // If session has a substitute teacher, use substitute; otherwise use original
            const effectiveTeacherId = session.substituteTeacherId || session.schedule?.teacherId;
            if (!effectiveTeacherId) continue;

            // Check if session attendance exists for the effective teacher
            const existing = await TeacherAttendance.findOne({
                where: {
                    teacherId: effectiveTeacherId,
                    sessionId: session.id
                }
            });

            if (!existing) {
                // === SMART CHECK: Does this teacher have a regular izin/sakit for this date? ===
                const regularLeave = await TeacherAttendance.findOne({
                    where: {
                        teacherId: effectiveTeacherId,
                        date: dateToProcess,
                        sessionId: { [Op.is]: null as any },
                        status: { [Op.in]: ['sick', 'permission'] }
                    }
                });

                if (regularLeave) {
                    // Cascade the leave status to the session (not alpha)
                    await TeacherAttendance.create({
                        teacherId: effectiveTeacherId,
                        sessionId: session.id,
                        date: dateToProcess,
                        status: (regularLeave as any).status,
                        checkInTime: undefined,
                        checkOutTime: undefined,
                        notes: `Auto-cascade: ${(regularLeave as any).status === 'sick' ? 'Sakit' : 'Izin'} — ${(regularLeave as any).notes || 'Tidak ada keterangan'}`
                    });
                    console.log(`   📋 Leave cascaded for teacher ${effectiveTeacherId} (session ${session.id}, status=${(regularLeave as any).status})`);
                    // Don't count as sessionCreated (it's a cascade, not alpha)
                } else {
                    await TeacherAttendance.create({
                        teacherId: effectiveTeacherId,
                        sessionId: session.id,
                        date: dateToProcess,
                        status: 'alpha',
                        checkInTime: undefined,
                        checkOutTime: undefined,
                        notes: session.substituteTeacherId
                            ? 'Auto-generated: Guru pengganti tidak hadir tanpa keterangan'
                            : 'Auto-generated: Tidak hadir mengajar tanpa keterangan'
                    });
                    console.log(`   ✅ Alpha created for teacher ${effectiveTeacherId} (session ${session.id}${session.substituteTeacherId ? ', substitute' : ''})`);
                    sessionCreated++;
                }
            }
        }

        console.log(`✅ Auto-fill alpha completed: ${regularCreated} regular, ${sessionCreated} session records created`);
        return { regularCreated, sessionCreated };

    } catch (error) {
        console.error('❌ Auto-fill alpha error:', error);
        throw error;
    }
};

/**
 * Admin trigger endpoint for manual alpha fill
 * POST /api/admin/trigger-alpha-fill
 */
export const triggerAutoFillAlpha = async (req: Request, res: Response): Promise<void> => {
    try {
        const { date } = req.body; // Optional: specific date to process
        const result = await autoFillAlpha(date);
        res.json({
            success: true,
            message: 'Alpha auto-fill completed',
            ...result
        });
    } catch (error) {
        console.error('Trigger alpha fill error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// IZIN/SAKIT SUBMISSION - Teacher leave requests
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Submit leave request (sakit/izin) — with assignment upload
 * POST /api/attendance/guru/submit-leave
 * Body (multipart/form-data): type, date, reason, assignmentText, file?
 */
export const submitLeave = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Find teacher by userId
        const teacher = await Teacher.findOne({ where: { userId } });
        if (!teacher) {
            res.status(404).json({ error: 'Teacher not found' });
            return;
        }

        const { type, date, reason, assignmentText } = req.body;
        const file = (req as any).file as Express.Multer.File | undefined;

        // ── Validation ──
        if (!type || !date) {
            res.status(400).json({ error: 'Jenis izin dan tanggal wajib diisi' });
            return;
        }
        if (!['sick', 'permission'].includes(type)) {
            res.status(400).json({ error: 'Jenis harus "sick" atau "permission"' });
            return;
        }
        if (!reason || reason.trim().length === 0) {
            res.status(400).json({ error: 'Alasan wajib diisi' });
            return;
        }
        // Must provide at least one: file OR assignmentText
        if (!file && (!assignmentText || assignmentText.trim().length === 0)) {
            res.status(400).json({ error: 'Wajib menyertakan tugas: upload file ATAU ketik tugas' });
            return;
        }

        const attachmentUrl = file ? `/uploads/assignments/${file.filename}` : undefined;

        // ── Auto-checkout if already checked in today ──
        const existingRegular = await TeacherAttendance.findOne({
            where: {
                teacherId: teacher.id,
                date,
                sessionId: { [Op.is]: null as any }
            }
        });

        let autoCheckedOut = false;
        if (existingRegular && existingRegular.checkInTime && !existingRegular.checkOutTime) {
            // Teacher already checked in — auto checkout
            const now = getJakartaTime();
            await existingRegular.update({
                checkOutTime: now,
                status: type,
                notes: reason,
                assignmentText: assignmentText || undefined,
                attachmentUrl: attachmentUrl || undefined,
            });
            autoCheckedOut = true;
        } else if (existingRegular) {
            // Record exists (maybe alpha or another status) — update
            await existingRegular.update({
                status: type,
                notes: reason,
                assignmentText: assignmentText || undefined,
                attachmentUrl: attachmentUrl || undefined,
            });
        } else {
            // No record yet — create new
            await TeacherAttendance.create({
                teacherId: teacher.id,
                date,
                status: type,
                checkInTime: undefined,
                checkOutTime: undefined,
                notes: reason,
                assignmentText: assignmentText || undefined,
                attachmentUrl: attachmentUrl || undefined,
            });
        }

        // ══════ CASCADE TO ALL SESSIONS ON THIS DATE ══════
        // Logic:
        // 1. If session is COMPLETED, do not change it (Teacher was present).
        // 2. If session is ONGOING, force finish it? Or just mark attendance as sick?
        //    For now, we mark attendance as sick/permission for any session that is NOT completed.
        const sessions = await Session.findAll({
            where: { date },
            include: [{
                model: Schedule,
                as: 'schedule',
                where: { teacherId: teacher.id },
            }],
        });

        let sessionsCascaded = 0;
        let sessionsImpacted = 0; // Sessions that were effectively cancelled/overridden

        for (const session of sessions as any[]) {
            // Skip if session is already completed (Teacher taught this class)
            if (session.status === 'completed') {
                continue;
            }

            const existingSession = await TeacherAttendance.findOne({
                where: { teacherId: teacher.id, sessionId: session.id }
            });

            if (existingSession) {
                if ((existingSession as any).status !== type) {
                    await existingSession.update({
                        status: type,
                        notes: `Limit Izin: ${reason}`,
                        checkOutTime: existingSession.checkInTime ? getJakartaTime() : undefined // Force checkout if checked in
                    });
                    sessionsCascaded++;
                    sessionsImpacted++;
                }
            } else {
                await TeacherAttendance.create({
                    teacherId: teacher.id,
                    sessionId: session.id,
                    date,
                    status: type,
                    checkInTime: undefined,
                    checkOutTime: undefined,
                    notes: `Cascade: ${reason}`
                });
                sessionsCascaded++;
                sessionsImpacted++;
            }
        }

        // Also count SCHEDULES that haven't become SESSIONS yet
        // (This catches classes later today that haven't been started)
        const dayOfWeek = new Date(date).getDay() || 7;
        const potentialSchedules = await Schedule.findAll({
            where: {
                teacherId: teacher.id,
                dayOfWeek,
                isActive: true
            }
        });

        // We want to count how many "periods" are missed. 
        // A rough approximation is fine, or we can trust `sessionsCascaded` if we ensure all sessions are created?
        // Actually, sessions are usually created ON DEMAND when scanning. 
        // If they don't exist yet, we can't cascade to them easily unless we pre-create them.
        // BUT: autoFillAlpha will handle them later if they remain missing.
        // BETTER: We should probably create the session records now to ensure they show up in "Guru Pengganti" page immediately.

        for (const sched of potentialSchedules) {
            // Check if session already exists in our `sessions` array
            const found = sessions.find((s: any) => s.scheduleId === sched.id);
            if (!found) {
                // Create session shell
                const newSession = await Session.create({
                    scheduleId: sched.id,
                    date,
                    status: 'scheduled', // It's scheduled but teacher is absent
                    startTime: sched.startTime,
                    endTime: sched.endTime
                });

                // Mark attendance as sick/permission
                await TeacherAttendance.create({
                    teacherId: teacher.id,
                    sessionId: newSession.id,
                    date,
                    status: type,
                    notes: `Cascade (Pre-generated): ${reason}`
                });
                sessionsCascaded++;
                sessionsImpacted++;
            }
        }

        console.log(`📋 Leave submitted for teacher ${teacher.id}: ${type}, impacted ${sessionsImpacted} sessions/schedules, autoCheckedOut: ${autoCheckedOut}`);

        res.status(existingRegular ? 200 : 201).json({
            success: true,
            message: `Izin berhasil ${existingRegular ? 'diperbarui' : 'diajukan'}.${autoCheckedOut ? ' Anda otomatis di-checkout.' : ''} ${sessionsImpacted > 0 ? `${sessionsImpacted} sesi KBM ditandai sebagai kosong (butuh pengganti).` : ''}`,
            sessionsCascaded: sessionsImpacted,
            autoCheckedOut,
            impactedSessions: sessionsImpacted
        });

    } catch (error) {
        console.error('Submit leave error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get leave history for current teacher
 * GET /api/attendance/guru/leave-history
 */
export const getLeaveHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const teacher = await Teacher.findOne({ where: { userId } });
        if (!teacher) {
            res.status(404).json({ error: 'Teacher not found' });
            return;
        }

        const leaves = await TeacherAttendance.findAll({
            where: {
                teacherId: teacher.id,
                status: { [Op.in]: ['sick', 'permission'] },
                sessionId: { [Op.is]: null as any }, // Only regular attendance records
            },
            order: [['date', 'DESC']],
            limit: 50
        });

        const formattedLeaves = leaves.map((l: any) => ({
            id: l.id,
            date: l.date,
            status: l.status,
            statusLabel: l.status === 'sick' ? 'Sakit' : 'Izin',
            reason: l.notes,
            assignmentText: l.assignmentText || null,
            attachmentUrl: l.attachmentUrl || null,
            createdAt: l.createdAt
        }));

        res.json({ leaves: formattedLeaves });

    } catch (error) {
        console.error('Get leave history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Download leave attachment file
 * GET /api/attendance/guru/leave-attachment/:id
 */
export const getLeaveAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const record = await TeacherAttendance.findByPk(id);
        if (!record || !record.attachmentUrl) {
            res.status(404).json({ error: 'Attachment not found' });
            return;
        }

        const filePath = path.join(__dirname, '../../', record.attachmentUrl);
        res.download(filePath);
    } catch (error) {
        console.error('Get leave attachment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


