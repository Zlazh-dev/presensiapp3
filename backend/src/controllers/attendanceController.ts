import { Request, Response } from 'express';
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

        const today = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toTimeString().split(' ')[0];

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
 */
export const autoFillAlpha = async (targetDate?: string): Promise<{ regularCreated: number; sessionCreated: number }> => {
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
                    notes: 'Auto-generated: Tidak ada rekap kehadiran reguler'
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
            const teacherId = session.schedule?.teacherId;
            if (!teacherId) continue;

            // Check if session attendance exists
            const existing = await TeacherAttendance.findOne({
                where: {
                    teacherId,
                    sessionId: session.id
                }
            });

            if (!existing) {
                await TeacherAttendance.create({
                    teacherId,
                    sessionId: session.id,
                    date: dateToProcess,
                    status: 'alpha',
                    checkInTime: undefined,
                    checkOutTime: undefined,
                    notes: 'Auto-generated: Tidak ada kehadiran untuk sesi ini'
                });
                console.log(`   ✅ Alpha created for ${session.schedule?.teacher?.user?.name || 'Unknown'} (session ${session.id})`);
                sessionCreated++;
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
 * Submit leave request (sakit/izin)
 * POST /api/attendance/guru/submit-leave
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

        const { type, date, reason } = req.body;
        // type: 'sick' | 'permission'

        if (!type || !date) {
            res.status(400).json({ error: 'type and date are required' });
            return;
        }

        if (!['sick', 'permission'].includes(type)) {
            res.status(400).json({ error: 'type must be "sick" or "permission"' });
            return;
        }

        // Check if already has attendance for this date
        const existing = await TeacherAttendance.findOne({
            where: {
                teacherId: teacher.id,
                date,
                sessionId: { [Op.is]: null as any } // Only check regular attendance
            }
        });

        if (existing) {
            // Update existing record
            await existing.update({
                status: type,
                notes: reason || undefined
            });
            res.json({ success: true, message: 'Izin berhasil diperbarui', attendance: existing });
            return;
        }

        // Create new attendance with leave status
        const attendance = await TeacherAttendance.create({
            teacherId: teacher.id,
            date,
            status: type,
            checkInTime: undefined,
            checkOutTime: undefined,
            notes: reason || undefined
        });

        res.status(201).json({ success: true, message: 'Izin berhasil diajukan', attendance });

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
                status: { [Op.in]: ['sick', 'permission'] }
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
            createdAt: l.createdAt
        }));

        res.json({ leaves: formattedLeaves });

    } catch (error) {
        console.error('Get leave history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
