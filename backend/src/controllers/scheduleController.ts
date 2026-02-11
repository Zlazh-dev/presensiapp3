import { Request, Response } from 'express';
import { Schedule, Class, Subject, Teacher, User, TimeSlot, Session, TeacherAttendance } from '../models';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { getIO } from '../socket';
import * as XLSX from 'xlsx';
import multer from 'multer';
import { getJakartaNow, getJakartaToday, getJakartaTime, getJakartaDayOfWeek } from '../utils/date';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const dayToNumber: Record<string, number> = {
    Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6,
};
const numberToDay: Record<number, string> = {
    1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu',
};

// ========== EXISTING CRUD ==========

export const getAllSchedules = async (req: Request, res: Response): Promise<void> => {
    try {
        const { classId, teacherId, dayOfWeek } = req.query;
        const where: any = {};

        if (classId) where.classId = classId;
        if (teacherId) where.teacherId = teacherId;
        if (dayOfWeek) where.dayOfWeek = dayOfWeek;

        const schedules = await Schedule.findAll({
            where,
            include: [
                { model: Class, as: 'class', attributes: ['id', 'name', 'level'] },
                { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
                {
                    model: Teacher, as: 'teacher',
                    include: [{ model: User, as: 'user', attributes: ['name'] }]
                }
            ],
            order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']]
        });

        res.json({ schedules });
    } catch (error) {
        console.error('Get schedules error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, academicYear } = req.body;

        if (!classId || !subjectId || !teacherId || !dayOfWeek || !startTime || !endTime || !academicYear) {
            res.status(400).json({ error: 'All fields are required' });
            return;
        }

        const overlap = await Schedule.findOne({
            where: {
                classId, dayOfWeek, academicYear,
                startTime: { [Op.lt]: endTime },
                endTime: { [Op.gt]: startTime }
            }
        });

        if (overlap) {
            res.status(409).json({ error: 'Schedule conflicts with an existing class schedule' });
            return;
        }

        const schedule = await Schedule.create({
            classId, subjectId, teacherId, dayOfWeek,
            startTime, endTime, academicYear, isActive: true
        });

        const fullSchedule = await Schedule.findByPk(schedule.id, {
            include: [
                { model: Class, as: 'class', attributes: ['id', 'name', 'level'] },
                { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
                { model: Teacher, as: 'teacher', include: [{ model: User, as: 'user', attributes: ['name'] }] }
            ]
        });

        try { getIO().emit('schedule:created', fullSchedule); } catch (e) { }

        res.status(201).json({ schedule: fullSchedule });
    } catch (error) {
        console.error('Create schedule error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, academicYear } = req.body;

        const schedule = await Schedule.findByPk(Number(id));
        if (!schedule) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }

        const whereClause: any = {
            id: { [Op.ne]: Number(id) },
            classId: classId || schedule.classId,
            dayOfWeek: dayOfWeek || schedule.dayOfWeek,
            academicYear: academicYear || schedule.academicYear,
            startTime: { [Op.lt]: endTime || schedule.endTime },
            endTime: { [Op.gt]: startTime || schedule.startTime }
        };

        const overlap = await Schedule.findOne({ where: whereClause });
        if (overlap) {
            res.status(409).json({ error: 'Schedule conflicts with an existing class schedule' });
            return;
        }

        await schedule.update({ classId, subjectId, teacherId, dayOfWeek, startTime, endTime, academicYear });

        // 1. Sync existing sessions for today (if any)
        const todayStr = getJakartaToday();

        const outputSchedule = await Schedule.findByPk(schedule.id, {
            include: [
                { model: Class, as: 'class', attributes: ['id', 'name', 'level'] },
                { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
                { model: Teacher, as: 'teacher', include: [{ model: User, as: 'user', attributes: ['name'] }] }
            ]
        });

        // Find session for today linked to this schedule
        const session = await Session.findOne({
            where: { scheduleId: schedule.id, date: todayStr }
        });

        if (session) {
            // Update session time/status if needed
            // Note: IF session is already completed, maybe don't touch it?
            // But if it's 'scheduled' or 'ongoing', we should update time.
            if (session.status !== 'completed' && session.status !== 'cancelled') {
                await session.update({
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                });

                // Emit session update to specific room
                try {
                    const io = getIO();
                    io.of('/sessions').to(`session-${session.id}`).emit('session:time-update', {
                        canCheckIn: true, // simplified, real logic is in getMyCurrentSession but this forces re-fetch
                        minutesUntilCheckIn: 0,
                        minutesUntilCheckOut: 0
                    });
                    // Force status change to trigger re-fetch
                    io.of('/sessions').to(`session-${session.id}`).emit('session:status-changed', {
                        status: session.status,
                        sessionId: session.id
                    });
                } catch (e) {
                    console.error('Socket emit error:', e);
                }
            }
        }

        // Emit global schedule update for this teacher/class
        try {
            getIO().of('/sessions').emit('schedule:updated', {
                teacherId: schedule.teacherId,
                classId: schedule.classId
            });
        } catch (e) { }

        res.json({ schedule: outputSchedule });
    } catch (error) {
        console.error('Update schedule error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const schedule = await Schedule.findByPk(Number(id));

        if (!schedule) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }

        // Delete dependent records first (FK constraints may not cascade at DB level)
        const sessions = await Session.findAll({ where: { scheduleId: Number(id) }, attributes: ['id'] });
        const sessionIds = sessions.map((s: any) => s.id);
        if (sessionIds.length > 0) {
            const { StudentAttendance } = require('../models');
            await StudentAttendance.destroy({ where: { sessionId: sessionIds } });
            await TeacherAttendance.destroy({ where: { sessionId: sessionIds } });
            await Session.destroy({ where: { id: sessionIds } });
        }

        await schedule.destroy();
        try { getIO().emit('schedule:deleted', Number(id)); } catch (e) { }

        res.json({ message: 'Schedule deleted successfully' });
    } catch (error) {
        console.error('Delete schedule error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Bulk delete schedules
 * POST /api/schedules/bulk-delete
 * Body: { ids: number[] }
 */
export const bulkDeleteSchedules = async (req: Request, res: Response): Promise<void> => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ error: 'ids array is required' });
            return;
        }

        // Delete dependent records first (FK constraints may not cascade at DB level)
        const sessions = await Session.findAll({ where: { scheduleId: ids }, attributes: ['id'] });
        const sessionIds = sessions.map((s: any) => s.id);

        if (sessionIds.length > 0) {
            // Delete student attendance linked to these sessions
            const { StudentAttendance } = require('../models');
            await StudentAttendance.destroy({ where: { sessionId: sessionIds } });
            // Delete teacher attendance linked to these sessions
            await TeacherAttendance.destroy({ where: { sessionId: sessionIds } });
            // Delete the sessions themselves
            await Session.destroy({ where: { id: sessionIds } });
        }

        const deleted = await Schedule.destroy({ where: { id: ids } });
        try { getIO().emit('schedule:deleted', ids); } catch (e) { }

        res.json({ message: `${deleted} jadwal berhasil dihapus`, count: deleted });
    } catch (error) {
        console.error('Bulk delete schedules error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ========== TEACHER: My Schedule ==========

/**
 * GET /api/schedules/my-schedule
 * Returns the logged-in teacher's schedule as a day×slot grid
 */
export const getMySchedule = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;

        // Find teacher record for this user
        const teacher = await Teacher.findOne({ where: { userId } });
        if (!teacher) {
            res.status(404).json({ error: 'Data guru tidak ditemukan' });
            return;
        }

        // Get all time slots
        const timeSlots = await TimeSlot.findAll({ order: [['slotNumber', 'ASC']] });

        // Get all schedules for this teacher
        const schedules = await Schedule.findAll({
            where: { teacherId: teacher.id },
            include: [
                { model: Class, as: 'class', attributes: ['id', 'name', 'level'] },
                { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
            ],
            order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']],
        });

        // Build grid: for each day, for each time slot, find matching schedule
        const grid = DAYS.map((day, index) => {
            const dayNumber = index + 1;
            const daySchedules = schedules.filter((s: any) => s.dayOfWeek === dayNumber);

            const slots = timeSlots.map((ts: any) => {
                const match = daySchedules.find((s: any) => {
                    const schedStart = s.startTime.substring(0, 5);
                    return schedStart === ts.startTime;
                });

                if (match) {
                    const m = match as any;
                    return {
                        scheduleId: m.id,
                        className: m.class?.name || '',
                        classId: m.class?.id,
                        subject: m.subject?.name || '',
                        subjectCode: m.subject?.code || '',
                    };
                }
                return null;
            });

            return { day, dayNumber, slots };
        });

        res.json({ grid, timeSlots, teacherName: (await User.findByPk(userId))?.name || '' });
    } catch (error) {
        console.error('Get my schedule error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ========== NEW: Grid / Bulk / Export / Import ==========

/**
 * GET /api/schedules/:classId/grid
 * Returns schedule data shaped as a grid: [{day, dayNumber, slots: [null|{scheduleId, subject, subjectId, teacher, teacherId}, ...]}]
 */
export const getScheduleGrid = async (req: Request, res: Response): Promise<void> => {
    try {
        const { classId } = req.params;

        // Get all time slots
        const timeSlots = await TimeSlot.findAll({ order: [['slotNumber', 'ASC']] });

        // Get all schedules for this class
        const schedules = await Schedule.findAll({
            where: { classId: Number(classId) },
            include: [
                { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
                {
                    model: Teacher, as: 'teacher',
                    include: [{ model: User, as: 'user', attributes: ['name'] }]
                }
            ],
            order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']]
        });

        // Build grid: for each day, for each time slot, find matching schedule
        const grid = DAYS.map((day, index) => {
            const dayNumber = index + 1;
            const daySchedules = schedules.filter((s: any) => s.dayOfWeek === dayNumber);

            const slots = timeSlots.map((ts: any) => {
                // Match by checking if schedule startTime matches slot startTime
                const match = daySchedules.find((s: any) => {
                    const schedStart = s.startTime.substring(0, 5); // "07:00:00" → "07:00"
                    return schedStart === ts.startTime;
                });

                if (match) {
                    const m = match as any;
                    return {
                        scheduleId: m.id,
                        subjectId: m.subject?.id,
                        subject: m.subject?.name || '',
                        subjectCode: m.subject?.code || '',
                        teacherId: m.teacher?.id,
                        teacher: m.teacher?.user?.name || '',
                    };
                }
                return null;
            });

            return { day, dayNumber, slots };
        });

        res.json({ grid, timeSlots });
    } catch (error) {
        console.error('Get schedule grid error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/schedules/:classId/bulk
 * Body: { assignments: [{ day: 'Senin', slotId: 1, subjectId: 2, teacherId: 3 }] }
 */
export const bulkAssign = async (req: Request, res: Response): Promise<void> => {
    const t = await sequelize.transaction();

    try {
        const { classId } = req.params;
        const { assignments } = req.body;

        if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
            res.status(400).json({ error: 'assignments array is required' });
            return;
        }

        // Get time slots for mapping slotId → time
        const timeSlots = await TimeSlot.findAll({ order: [['slotNumber', 'ASC']] });
        const slotMap = new Map(timeSlots.map((ts: any) => [ts.slotNumber, ts]));

        const results: any[] = [];

        for (const assignment of assignments) {
            const { day, slotId, subjectId, teacherId } = assignment;
            const dayNumber = dayToNumber[day];
            if (!dayNumber) {
                await t.rollback();
                res.status(400).json({ error: `Invalid day: ${day}` });
                return;
            }

            const slot = slotMap.get(slotId);
            if (!slot) {
                await t.rollback();
                res.status(400).json({ error: `Invalid slot ID: ${slotId}` });
                return;
            }

            const startTime = (slot as any).startTime;
            const endTime = (slot as any).endTime;

            // Find existing schedule for this class+day+startTime and update, or create new
            const [schedule, created] = await Schedule.findOrCreate({
                where: {
                    classId: Number(classId),
                    dayOfWeek: dayNumber,
                    startTime,
                },
                defaults: {
                    classId: Number(classId),
                    subjectId,
                    teacherId,
                    dayOfWeek: dayNumber,
                    startTime,
                    endTime,
                    academicYear: '2025/2026',
                    isActive: true,
                },
                transaction: t,
            });

            if (!created) {
                await schedule.update({ subjectId, teacherId }, { transaction: t });
            }

            results.push(schedule);
        }

        await t.commit();

        // --- Post-transaction: Sync Sessions & Emit Events ---
        try {
            const todayStr = getJakartaToday();
            const io = getIO();

            for (const sched of results) {
                // Check if session exists today
                const session = await Session.findOne({
                    where: { scheduleId: sched.id, date: todayStr }
                });

                if (session && session.status !== 'completed' && session.status !== 'cancelled') {
                    await session.update({
                        startTime: sched.startTime,
                        endTime: sched.endTime
                    });
                    // Emit to session room
                    io.of('/sessions').to(`session-${session.id}`).emit('session:status-changed', {
                        status: session.status,
                        sessionId: session.id
                    });
                }
            }

            // Emit general update
            io.of('/sessions').emit('schedule:updated', { classId: Number(classId) });
        } catch (e) {
            console.error('Error syncing sessions/sockets:', e);
        }

        try { getIO().emit('schedule:bulk-updated', { classId }); } catch (e) { }

        res.json({ message: `${results.length} schedule(s) assigned`, count: results.length });
    } catch (error) {
        await t.rollback();
        console.error('Bulk assign error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/schedules/:classId/export-template
 * Downloads an empty XLSX template with Hari × Jam columns
 */
export const exportTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { classId } = req.params;
        const cls = await Class.findByPk(Number(classId));
        if (!cls) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        const timeSlots = await TimeSlot.findAll({ order: [['slotNumber', 'ASC']] });

        // Build header row
        const headers = ['Hari', ...timeSlots.map((ts: any) => `${ts.startTime}-${ts.endTime}`)];

        // Build data rows (empty cells)
        const rows = DAYS.map(day => {
            const row: any = { Hari: day };
            timeSlots.forEach((ts: any) => {
                row[`${ts.startTime}-${ts.endTime}`] = '';
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

        // Set column widths
        ws['!cols'] = headers.map((h, i) => ({ wch: i === 0 ? 10 : 20 }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Jadwal ${(cls as any).name}`);

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=jadwal_${(cls as any).name}.xlsx`);
        res.send(buffer);
    } catch (error) {
        console.error('Export template error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/schedules/:classId/import
 * Upload XLSX → parse → bulk assign
 * Expected format: first column is Hari, remaining columns are time slot ranges
 * Cell values: "SubjectCode - TeacherName" or "SubjectName - TeacherName"
 */
export const importSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { classId } = req.params;

        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const workbook = XLSX.read(req.file.buffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            res.status(400).json({ error: 'Empty spreadsheet' });
            return;
        }

        // Get time slots and subjects/teachers for mapping
        const timeSlots = await TimeSlot.findAll({ order: [['slotNumber', 'ASC']] });
        const subjects = await Subject.findAll();
        const teachers = await Teacher.findAll({
            include: [{ model: User, as: 'user', attributes: ['name'] }]
        });

        const assignments: any[] = [];
        const errors: string[] = [];

        for (const row of data) {
            const day = row['Hari'];
            if (!day || !dayToNumber[day]) {
                errors.push(`Invalid or missing Hari: ${day}`);
                continue;
            }

            for (const ts of timeSlots) {
                const tsAny = ts as any;
                const colKey = `${tsAny.startTime}-${tsAny.endTime}`;
                const cellValue = row[colKey];

                if (!cellValue || !cellValue.toString().trim()) continue;

                const parts = cellValue.toString().split('-').map((p: string) => p.trim());
                if (parts.length < 2) {
                    errors.push(`Invalid format at ${day}/${colKey}: "${cellValue}" (expected "Subject - Teacher")`);
                    continue;
                }

                const subjectName = parts[0];
                const teacherName = parts.slice(1).join('-').trim(); // Handle teacher names with dashes

                // Find subject by name or code
                const subject = subjects.find((s: any) =>
                    s.name.toLowerCase() === subjectName.toLowerCase() ||
                    s.code.toLowerCase() === subjectName.toLowerCase()
                );

                if (!subject) {
                    errors.push(`Subject not found: "${subjectName}" at ${day}/${colKey}`);
                    continue;
                }

                // Find teacher by name
                const teacher = teachers.find((t: any) =>
                    t.user?.name?.toLowerCase() === teacherName.toLowerCase()
                );

                if (!teacher) {
                    errors.push(`Teacher not found: "${teacherName}" at ${day}/${colKey}`);
                    continue;
                }

                assignments.push({
                    day,
                    slotId: tsAny.slotNumber,
                    subjectId: (subject as any).id,
                    teacherId: (teacher as any).id,
                });
            }
        }

        if (assignments.length === 0) {
            res.status(400).json({
                error: 'No valid assignments found in the spreadsheet',
                details: errors,
            });
            return;
        }

        // Use bulkAssign logic in a transaction
        const t = await sequelize.transaction();
        try {
            const slotMap = new Map(timeSlots.map((ts: any) => [ts.slotNumber, ts]));

            for (const assignment of assignments) {
                const { day, slotId, subjectId, teacherId } = assignment;
                const dayNumber = dayToNumber[day];
                const slot = slotMap.get(slotId) as any;

                const [schedule, created] = await Schedule.findOrCreate({
                    where: {
                        classId: Number(classId),
                        dayOfWeek: dayNumber,
                        startTime: slot.startTime,
                    },
                    defaults: {
                        classId: Number(classId),
                        subjectId,
                        teacherId,
                        dayOfWeek: dayNumber,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        academicYear: '2025/2026',
                        isActive: true,
                    },
                    transaction: t,
                });

                if (!created) {
                    await schedule.update({ subjectId, teacherId }, { transaction: t });
                }
            }

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }

        try { getIO().emit('schedule:bulk-updated', { classId }); } catch (e) { }

        res.json({
            message: `Imported ${assignments.length} schedule(s) successfully`,
            count: assignments.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('Import schedule error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Multer middleware for file upload
export const uploadMiddleware = multer({ storage: multer.memoryStorage() }).single('file');

// ========== GURU PENGGANTI (Substitute Teacher) ==========

/**
 * GET /api/schedules/upcoming?hours=24
 * Returns today's sessions where the assigned teacher has NOT checked in.
 * Only shows sessions from real Manajemen Jadwal schedules.
 */
export const getUpcomingSessions = async (req: Request, res: Response): Promise<void> => {
    try {
        // TZ is set to Asia/Jakarta in server.ts — new Date() is already WIB
        const jakartaTime = getJakartaNow();
        const today = getJakartaToday();
        const dayOfWeek = getJakartaDayOfWeek();
        const currentTime = getJakartaTime();

        // 1. Find schedules for today's day-of-week (real schedules from Manajemen Jadwal)
        const todaySchedules = await Schedule.findAll({
            where: { dayOfWeek, isActive: true },
            include: [
                { model: Class, as: 'class', attributes: ['id', 'name'] },
                { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
                {
                    model: Teacher, as: 'teacher',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
                },
            ],
        });

        if (todaySchedules.length === 0) {
            res.json({ sessions: [], count: 0, currentTime });
            return;
        }

        // 2. Get teacher IDs who HAVE checked in today (present or late)
        // Use imported TeacherAttendance model
        const checkedInRecords = await TeacherAttendance.findAll({
            where: {
                date: today,
                status: { [Op.in]: ['present', 'late'] },
            },
            attributes: ['teacherId', 'checkInTime'],
        });
        const checkedInTeacherIds = new Set(checkedInRecords.map((r: any) => r.teacherId));
        const teacherCheckInTimes: Record<number, string> = {};
        checkedInRecords.forEach((r: any) => {
            teacherCheckInTimes[r.teacherId] = r.checkInTime;
        });

        // 3. Get existing sessions for today to check which ones are actually started
        const existingSessions = await Session.findAll({
            where: { date: today },
            attributes: ['id', 'scheduleId', 'status', 'substituteTeacherId'],
        });
        const sessionByScheduleId: Record<number, any> = {};
        for (const s of existingSessions as any[]) {
            sessionByScheduleId[s.scheduleId] = s;
        }

        // 4. Build results — show sessions that need a substitute:
        //    (a) Teacher is absent (not checked in) — always needs substitute
        //    (b) Teacher is present but class time has started and session NOT started (no QR scan)
        const result: any[] = [];
        for (const sched of todaySchedules as any[]) {
            const teacherIsPresent = checkedInTeacherIds.has(sched.teacherId);

            // Time calculations
            const sessionStartDt = new Date(`${today}T${sched.startTime}`);
            const sessionEndDt = new Date(`${today}T${sched.endTime}`);
            const startMs = sessionStartDt.getTime();
            const endMs = sessionEndDt.getTime();
            const nowMs = jakartaTime.getTime();

            // Check if there's an existing session and its status
            const existingSession = sessionByScheduleId[sched.id];
            const sessionStarted = existingSession && (existingSession.status === 'ongoing' || existingSession.status === 'completed');

            // Skip if teacher is present AND has already started the session (or session completed)
            if (teacherIsPresent && sessionStarted) continue;

            // Skip if teacher is present AND class hasn't started yet (they'll likely show up)
            if (teacherIsPresent && nowMs < startMs) continue;

            // Skip if class time has ended and no session was created (nothing to substitute anymore)
            if (nowMs > endMs && !existingSession) continue;

            // Find or create the session for this schedule today
            const [session] = await Session.findOrCreate({
                where: { scheduleId: sched.id, date: today },
                defaults: {
                    scheduleId: sched.id, date: today,
                    startTime: sched.startTime, status: 'scheduled',
                },
            });

            const sess = session as any;
            // If session is already completed or ongoing (started by teacher), skip
            if (sess.status === 'completed' || sess.status === 'ongoing') continue;

            let substituteTeacher = null;
            let substituteCheckedIn = false;
            if (sess.substituteTeacherId) {
                const subTeacher = await Teacher.findByPk(sess.substituteTeacherId, {
                    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
                });
                substituteTeacher = subTeacher
                    ? { id: (subTeacher as any).id, name: (subTeacher as any).user?.name }
                    : null;
                substituteCheckedIn = checkedInTeacherIds.has(sess.substituteTeacherId);
            }

            const countdownMs = startMs - nowMs;
            const countdownMins = Math.round(countdownMs / 60000);

            // Session status determination
            let sessionStatus: 'upcoming' | 'ongoing' | 'completed' = 'upcoming';

            if (sess.status === 'completed') {
                sessionStatus = 'completed';
            } else if (sess.status === 'ongoing') {
                sessionStatus = 'ongoing';
            } else if (nowMs >= startMs && nowMs <= endMs) {
                sessionStatus = 'ongoing';
            } else if (nowMs > endMs) {
                sessionStatus = 'completed';
            }

            // Warning: class time has started but no teacher is actively teaching
            const hasAnyTeacher = substituteCheckedIn;
            const warning = sessionStatus === 'ongoing' && !hasAnyTeacher;

            result.push({
                id: sess.id,
                scheduleId: sched.id,
                date: today,
                startTime: sched.startTime,
                endTime: sched.endTime,
                status: sess.status,
                substituteTeacherId: sess.substituteTeacherId,
                substituteTeacher,
                substituteCheckedIn,
                // Real-time countdown data
                countdownMins,
                countdownMs: Math.max(0, countdownMs),
                startTimeMs: startMs,
                endTimeMs: endMs,
                serverTimeMs: nowMs,
                // Status
                sessionStatus,
                warning,
                // Why this session needs attention
                reason: teacherIsPresent ? 'not_started' : 'absent',
                class: sched.class ? { id: sched.class.id, name: sched.class.name } : null,
                subject: sched.subject ? { id: sched.subject.id, name: sched.subject.name, code: sched.subject.code } : null,
                teacher: sched.teacher ? { id: sched.teacher.id, name: sched.teacher.user?.name } : null,
            });
        }

        // Sort by start time
        result.sort((a, b) => a.startTime.localeCompare(b.startTime));

        res.json({ sessions: result, count: result.length, currentTime, serverTimeMs: jakartaTime.getTime() });
    } catch (error: any) {
        console.error('Get upcoming sessions error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * PUT /api/schedules/:sessionId/substitute/:teacherId
 * Assign a substitute teacher to a session
 */
export const assignSubstitute = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId, teacherId } = req.params;

        const session = await Session.findByPk(Number(sessionId));
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const teacher = await Teacher.findByPk(Number(teacherId), {
            include: [{ model: User, as: 'user', attributes: ['name'] }],
        });
        if (!teacher) {
            res.status(404).json({ error: 'Teacher not found' });
            return;
        }

        await session.update({ substituteTeacherId: Number(teacherId) });

        // Emit real-time event
        try {
            getIO().emit('substitute:assigned', {
                sessionId: session.id,
                teacherId: Number(teacherId),
                teacherName: (teacher as any).user?.name,
            });
        } catch { }

        res.json({
            message: `Guru pengganti berhasil ditugaskan`,
            session: {
                id: session.id,
                substituteTeacherId: Number(teacherId),
                substituteTeacherName: (teacher as any).user?.name,
            },
        });
    } catch (error) {
        console.error('Assign substitute error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/schedules/available-teachers
 * Returns teachers who HAVE checked in today (present/late) and thus are
 * available in the building to serve as substitutes.
 * Teachers who haven't checked in are absent — they can't substitute.
 */
export const getAvailableTeachers = async (req: Request, res: Response): Promise<void> => {
    try {
        // TZ is set to Asia/Jakarta — new Date() is already WIB
        const today = getJakartaToday();
        const dayOfWeek = getJakartaDayOfWeek();
        const currentTime = getJakartaTime();

        // 1. Find teacher attendance records for today
        const { TeacherAttendance } = require('../models');
        const todayAttendance = await TeacherAttendance.findAll({
            where: {
                date: today,
                status: { [Op.in]: ['present', 'late'] },
            },
            attributes: ['teacherId', 'checkOutTime', 'sessionId'],
        });

        // Build sets: who checked in at all, who has checked out (left the building)
        const checkedInIds = new Set<number>();
        const checkedOutIds = new Set<number>();
        for (const att of todayAttendance as any[]) {
            checkedInIds.add(att.teacherId);
            // Teacher has checked out = they LEFT the building
            // For regular attendance (sessionId null): checkOutTime means they left
            // For session attendance: checkOutTime just means session ended, not necessarily left
            if (!att.sessionId && att.checkOutTime) {
                checkedOutIds.add(att.teacherId);
            }
        }

        // Teachers still in building = checked in but NOT checked out (regular attendance)
        const stillInBuildingIds = new Set<number>();
        for (const id of checkedInIds) {
            if (!checkedOutIds.has(id)) {
                stillInBuildingIds.add(id);
            }
        }

        // 2. Find teachers who are busy right now
        // A teacher is busy ONLY if they have an ongoing session (explicitly started via QR scan)
        const currentlyTeachingIds = new Set<number>();

        const ongoingSessions = await Session.findAll({
            where: {
                date: today,
                status: 'ongoing',
            },
            include: [{ model: Schedule, as: 'schedule', attributes: ['teacherId'] }],
        });
        for (const s of ongoingSessions as any[]) {
            if (s.schedule?.teacherId) currentlyTeachingIds.add(s.schedule.teacherId);
            if (s.substituteTeacherId) currentlyTeachingIds.add(s.substituteTeacherId);
        }

        // 3. Get all teachers
        const allTeachers = await Teacher.findAll({
            include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
        });

        const available = allTeachers
            .map((t: any) => ({
                id: t.id,
                userId: t.userId,
                name: t.user?.name || 'Unknown',
                employeeId: t.employeeId,
                isCheckedIn: stillInBuildingIds.has(t.id), // Currently in building (not checked out)
                hasCheckedOut: checkedOutIds.has(t.id), // Has left the building
                isBusy: currentlyTeachingIds.has(t.id), // Currently teaching (by DB status or schedule time)
            }));

        res.json({ teachers: available });
    } catch (error) {
        console.error('Get available teachers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
