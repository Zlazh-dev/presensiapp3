import { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import {
    TeacherAttendance, StudentAttendance,
    Teacher, Student, User, Class, Session, Schedule, Subject,
} from '../models';
import * as XLSX from 'xlsx';

// ========== 1. Guru Reguler (Daily Briefing) ==========
/**
 * GET /api/attendance/guru/regular?start=YYYY-MM-DD&end=YYYY-MM-DD&guruId=
 * Returns teacher daily attendance rows within the date range
 * This is for DAILY BRIEFING check-in, NOT for teaching sessions
 */
export const getGuruRegular = async (req: Request, res: Response): Promise<void> => {
    try {
        const { start, end, guruId } = req.query;
        if (!start || !end) {
            res.status(400).json({ error: 'start and end query params required' });
            return;
        }

        const whereClause: any = {
            date: { [Op.between]: [start as string, end as string] },
            // ONLY include attendance records WITHOUT sessionId (daily briefing)
            sessionId: null as any,
        };
        if (guruId) {
            whereClause.teacherId = Number(guruId);
        }

        const records = await TeacherAttendance.findAll({
            where: whereClause,
            include: [
                {
                    model: Teacher,
                    as: 'teacher',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
                },
            ],
            order: [['date', 'ASC'], ['checkInTime', 'ASC']],
        });

        const rows = records.map((r: any) => ({
            id: r.id,
            date: r.date,
            teacherId: r.teacherId,
            teacherName: r.teacher?.user?.name || 'Unknown',
            employeeId: r.teacher?.employeeId,
            status: r.status,
            lateMinutes: r.lateMinutes || null,
            statusLabel: r.status === 'late' && r.lateMinutes
                ? `Telat ${r.lateMinutes} menit`
                : r.status === 'present' ? 'Hadir'
                    : r.status === 'absent' ? 'Absen'
                        : r.status === 'sick' ? 'Sakit'
                            : r.status === 'permission' ? 'Izin'
                                : r.status,
            checkInTime: r.checkInTime,
            checkOutTime: r.checkOutTime,
            earlyCheckoutMinutes: r.earlyCheckoutMinutes || null,
            checkoutStatusLabel: r.earlyCheckoutMinutes
                ? `Lebih awal ${r.earlyCheckoutMinutes} menit`
                : r.checkOutTime ? 'Normal' : null,
            notes: r.notes,
        }));

        res.json({ rows, count: rows.length });
    } catch (error) {
        console.error('getGuruRegular error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ========== 1.5. Guru Per Sesi Mengajar (KBM) ==========
/**
 * Deduplication utility function
 * Ensures no duplicate sessions for same teacher-date-class-subject combination
 */
const deduplicateSessions = (sessions: any[]): any[] => {
    const uniqueMap = new Map<string, any>();

    for (const session of sessions) {
        const schedule = session.schedule;
        const teacherId = schedule?.teacherId || session.substituteTeacherId;
        const classId = schedule?.classId;
        const subjectId = schedule?.subjectId;
        const date = session.date;

        // Create unique key: teacherId-date-classId-subjectId
        const key = `${teacherId}-${date}-${classId}-${subjectId}`;

        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, session);
        } else {
            // Keep session with earlier check-in time
            const existing = uniqueMap.get(key);
            if (new Date(session.startTime) < new Date(existing.startTime)) {
                uniqueMap.set(key, session);
            }
        }
    }

    return Array.from(uniqueMap.values());
};

/**
 * GET /api/attendance/guru/mengajar?start=YYYY-MM-DD&end=YYYY-MM-DD&guruId=
 * SINGLE SOURCE OF TRUTH: Returns per-session teaching attendance from sessions table
 * This is the ONLY source for teaching attendance rekap
 */
export const getGuruMengajar = async (req: Request, res: Response): Promise<void> => {
    try {
        const { start, end, guruId } = req.query;
        if (!start || !end) {
            res.status(400).json({ error: 'start and end query params required' });
            return;
        }

        const whereClause: any = {
            date: { [Op.between]: [start as string, end as string] },
            status: { [Op.in]: ['ongoing', 'completed'] }, // Only active or completed sessions
        };

        // Get sessions with full schedule info
        const sessions = await Session.findAll({
            where: whereClause,
            include: [
                {
                    model: Schedule,
                    as: 'schedule',
                    include: [
                        { model: Class, as: 'class', attributes: ['id', 'name'] },
                        { model: Subject, as: 'subject', attributes: ['id', 'name'] },
                        {
                            model: Teacher,
                            as: 'teacher',
                            include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
                        },
                    ],
                },
                {
                    model: TeacherAttendance,
                    as: 'teacherAttendance',
                    required: true, // Only sessions with attendance record
                },
            ],
            order: [['date', 'DESC'], ['startTime', 'DESC']],
        });

        // Filter by guruId if provided
        let filteredSessions = sessions as any[];
        if (guruId) {
            const teacherIdNum = Number(guruId);
            filteredSessions = filteredSessions.filter(s =>
                s.schedule?.teacherId === teacherIdNum ||
                s.substituteTeacherId === teacherIdNum
            );
        }

        // Apply deduplication
        const deduplicated = deduplicateSessions(filteredSessions);

        // Transform to response format
        const rows = deduplicated.map((s: any) => {
            const schedule = s.schedule;
            const attendance = s.teacherAttendance?.[0];
            const teacher = schedule?.teacher;

            // Calculate duration in minutes
            let durationMinutes = 0;
            if (attendance?.checkInTime && attendance?.checkOutTime) {
                const checkIn = new Date(`1970-01-01T${attendance.checkInTime}`);
                const checkOut = new Date(`1970-01-01T${attendance.checkOutTime}`);
                durationMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
            }

            return {
                id: s.id,
                date: s.date,
                teacherId: schedule?.teacherId,
                teacherName: teacher?.user?.name || 'Unknown',
                employeeId: teacher?.employeeId,
                className: schedule?.class?.name || 'Unknown',
                subjectName: schedule?.subject?.name || 'Unknown',
                status: attendance?.status || 'present',
                statusLabel: s.status === 'completed' ? 'Selesai' : 'Aktif',
                checkInTime: attendance?.checkInTime || s.startTime,
                checkOutTime: attendance?.checkOutTime || null,
                durationMinutes,
                sessionStatus: s.status,
                notes: s.notes || attendance?.notes,
                isSubstitute: s.substituteTeacherId != null,
            };
        });

        res.json({
            rows,
            count: rows.length,
            source: 'sessions', // Indicate this is from sessions table (single source of truth)
        });
    } catch (error) {
        console.error('getGuruMengajar error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


// ========== 2. Guru Per Kelas ==========
/**
 * GET /api/attendance/guru/class?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns per-class session attendance summary for teachers
 */
export const getGuruClass = async (req: Request, res: Response): Promise<void> => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            res.status(400).json({ error: 'start and end query params required' });
            return;
        }

        // Get sessions in range with schedule info — only completed/ongoing (actual teaching)
        const sessions = await Session.findAll({
            where: {
                date: { [Op.between]: [start as string, end as string] },
                status: { [Op.in]: ['ongoing', 'completed'] },
            },
            include: [
                {
                    model: Schedule,
                    as: 'schedule',
                    include: [
                        { model: Class, as: 'class', attributes: ['id', 'name'] },
                        { model: Subject, as: 'subject', attributes: ['id', 'name'] },
                        {
                            model: Teacher,
                            as: 'teacher',
                            include: [{ model: User, as: 'user', attributes: ['name'] }],
                        },
                    ],
                },
                {
                    model: TeacherAttendance,
                    as: 'teacherAttendance',
                    include: [{ model: Teacher, as: 'teacher', include: [{ model: User, as: 'user', attributes: ['name'] }] }]
                },
            ],
            order: [['date', 'ASC']],
        });

        // Deduplicate: same teacher-date-class-subject combo
        const deduplicated = deduplicateSessions(sessions as any[]);

        // Group by class
        const classMap = new Map<number, any>();
        for (const s of deduplicated) {
            const cls = s.schedule?.class;
            if (!cls) continue;
            if (!classMap.has(cls.id)) {
                classMap.set(cls.id, {
                    classId: cls.id,
                    className: cls.name,
                    totalSessions: 0,
                    attended: 0,
                    absent: 0,
                    sessions: [],
                });
            }
            const entry = classMap.get(cls.id)!;
            entry.totalSessions++;
            const att = s.teacherAttendance?.[0];
            if (att && ['present', 'late'].includes(att.status)) {
                entry.attended++;
            } else {
                entry.absent++;
            }
            entry.sessions.push({
                date: s.date,
                startTime: s.startTime,
                subject: s.schedule?.subject?.name,
                teacher: att?.teacher?.user?.name || s.schedule?.teacher?.user?.name,
                status: att?.status || 'no_record',
            });
        }

        const result = Array.from(classMap.values())
            .map((c) => ({
                ...c,
                percentage: c.totalSessions > 0
                    ? Math.round((c.attended / c.totalSessions) * 100)
                    : 0,
            }))
            .sort((a, b) => a.className.localeCompare(b.className));

        res.json({ classes: result });
    } catch (error) {
        console.error('getGuruClass error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ========== 3. Siswa Summary ==========
/**
 * GET /api/attendance/siswa/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns per-class student attendance stats
 */
export const getSiswaSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            res.status(400).json({ error: 'start and end query params required' });
            return;
        }

        const classes = await Class.findAll({
            include: [{ model: Student, as: 'students', attributes: ['id'] }],
            order: [['name', 'ASC']],
        });

        const result = [];
        for (const cls of classes as any[]) {
            const studentIds = cls.students.map((s: any) => s.id);
            if (studentIds.length === 0) {
                result.push({
                    classId: cls.id,
                    className: cls.name,
                    totalStudents: 0,
                    present: 0, absent: 0, sick: 0, permission: 0, late: 0,
                    percentage: 0,
                });
                continue;
            }

            // Get sessions for this class in range
            const sessions = await Session.findAll({
                where: {
                    date: { [Op.between]: [start as string, end as string] },
                },
                include: [{
                    model: Schedule,
                    as: 'schedule',
                    where: { classId: cls.id },
                    attributes: ['id'],
                }],
                attributes: ['id'],
            });

            const sessionIds = sessions.map((s: any) => s.id);
            if (sessionIds.length === 0) {
                result.push({
                    classId: cls.id,
                    className: cls.name,
                    totalStudents: studentIds.length,
                    present: 0, absent: 0, sick: 0, permission: 0, late: 0,
                    percentage: 0,
                    totalSessions: 0,
                });
                continue;
            }

            const attendances = await StudentAttendance.findAll({
                where: {
                    studentId: { [Op.in]: studentIds },
                    sessionId: { [Op.in]: sessionIds },
                },
                attributes: ['status'],
            });

            const counts = { present: 0, absent: 0, sick: 0, permission: 0, late: 0 };
            for (const a of attendances as any[]) {
                if (counts[a.status as keyof typeof counts] !== undefined) {
                    counts[a.status as keyof typeof counts]++;
                }
            }

            const total = attendances.length;
            result.push({
                classId: cls.id,
                className: cls.name,
                totalStudents: studentIds.length,
                totalSessions: sessionIds.length,
                ...counts,
                percentage: total > 0
                    ? Math.round(((counts.present + counts.late) / total) * 100)
                    : 0,
            });
        }

        res.json({ classes: result });
    } catch (error) {
        console.error('getSiswaSummary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ========== 4. Siswa Detail ==========
/**
 * GET /api/attendance/siswa/:classId/detail?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns per-student attendance detail for a class
 */
export const getSiswaDetail = async (req: Request, res: Response): Promise<void> => {
    try {
        const { classId } = req.params;
        const { start, end } = req.query;
        if (!start || !end) {
            res.status(400).json({ error: 'start and end query params required' });
            return;
        }

        const students = await Student.findAll({
            where: { classId: Number(classId) },
            attributes: ['id', 'nis', 'name', 'gender'],
            order: [['name', 'ASC']],
        });

        // Get sessions for this class in date range
        const sessions = await Session.findAll({
            where: {
                date: { [Op.between]: [start as string, end as string] },
            },
            include: [{
                model: Schedule,
                as: 'schedule',
                where: { classId: Number(classId) },
                attributes: ['id'],
            }],
            attributes: ['id', 'date', 'startTime'],
            order: [['date', 'ASC']],
        });

        const sessionIds = sessions.map((s: any) => s.id);

        const result = [];
        for (const student of students as any[]) {
            const attendances = await StudentAttendance.findAll({
                where: {
                    studentId: student.id,
                    sessionId: { [Op.in]: sessionIds },
                },
                attributes: ['sessionId', 'status'],
            });

            const statusMap: Record<string, number> = { present: 0, absent: 0, sick: 0, permission: 0, late: 0 };
            for (const a of attendances as any[]) {
                if (statusMap[a.status] !== undefined) statusMap[a.status]++;
            }

            const total = attendances.length;
            result.push({
                studentId: student.id,
                nis: student.nis,
                name: student.name,
                gender: student.gender,
                totalSessions: sessionIds.length,
                ...statusMap,
                percentage: total > 0
                    ? Math.round(((statusMap.present + statusMap.late) / total) * 100)
                    : 0,
            });
        }

        res.json({ students: result, totalSessions: sessionIds.length });
    } catch (error) {
        console.error('getSiswaDetail error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ========== 5. Export ==========
/**
 * POST /api/attendance/export/:type
 * type = 'guru-regular' | 'guru-class' | 'siswa-summary'
 * Body: { start, end }
 */
export const exportAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        const { type } = req.params;
        const { start, end } = req.body;

        if (!start || !end) {
            res.status(400).json({ error: 'start and end are required in body' });
            return;
        }

        let rows: any[] = [];
        let sheetName = 'Export';

        if (type === 'guru-regular') {
            const records = await TeacherAttendance.findAll({
                where: { date: { [Op.between]: [start, end] } },
                include: [{
                    model: Teacher, as: 'teacher',
                    include: [{ model: User, as: 'user', attributes: ['name'] }],
                }],
                order: [['date', 'ASC']],
            });
            rows = records.map((r: any) => ({
                Tanggal: r.date,
                Guru: r.teacher?.user?.name || '',
                'NIP': r.teacher?.employeeId || '',
                Status: r.status,
                'Jam Masuk': r.checkInTime || '-',
                'Jam Keluar': r.checkOutTime || '-',
                Catatan: r.notes || '',
            }));
            sheetName = 'Rekap Guru';
        } else if (type === 'siswa-summary') {
            // Per-student detail export grouped by class
            const classes = await Class.findAll({
                include: [{ model: Student, as: 'students', attributes: ['id', 'nis', 'name', 'gender'] }],
                order: [['name', 'ASC']],
            });

            for (const cls of classes as any[]) {
                // Sort students alphabetically
                const sortedStudents = [...cls.students].sort((a: any, b: any) =>
                    a.name.localeCompare(b.name)
                );
                const studentIds = sortedStudents.map((s: any) => s.id);

                // Get sessions for this class
                const sessions = await Session.findAll({
                    where: { date: { [Op.between]: [start, end] } },
                    include: [{ model: Schedule, as: 'schedule', where: { classId: cls.id }, attributes: ['id'] }],
                    attributes: ['id'],
                });
                const sessionIds = sessions.map((s: any) => s.id);

                let classTotalPresent = 0, classTotalLate = 0, classTotalSick = 0, classTotalPermission = 0, classTotalAbsent = 0;

                for (const student of sortedStudents as any[]) {
                    const attendances = await StudentAttendance.findAll({
                        where: { studentId: student.id, sessionId: { [Op.in]: sessionIds } },
                        attributes: ['status'],
                    });

                    const counts: Record<string, number> = { present: 0, absent: 0, sick: 0, permission: 0, late: 0 };
                    for (const a of attendances as any[]) {
                        if (counts[a.status] !== undefined) counts[a.status]++;
                    }
                    const total = attendances.length;
                    const pct = total > 0 ? Math.round(((counts.present + counts.late) / total) * 100) : 0;

                    classTotalPresent += counts.present;
                    classTotalLate += counts.late;
                    classTotalSick += counts.sick;
                    classTotalPermission += counts.permission;
                    classTotalAbsent += counts.absent;

                    rows.push({
                        'NIS': student.nis || '-',
                        'Nama': student.name,
                        'JK': student.gender === 'M' ? 'L' : 'P',
                        'Kelas': cls.name,
                        'Hadir': counts.present,
                        'Terlambat': counts.late,
                        'Sakit': counts.sick,
                        'Izin': counts.permission,
                        'Absen': counts.absent,
                        'Kehadiran (%)': `${pct}%`,
                    });
                }

                // Class subtotal row
                const classTotal = classTotalPresent + classTotalLate + classTotalSick + classTotalPermission + classTotalAbsent;
                const classPct = classTotal > 0 ? Math.round(((classTotalPresent + classTotalLate) / classTotal) * 100) : 0;
                rows.push({
                    'NIS': '',
                    'Nama': `Subtotal ${cls.name} (${studentIds.length} siswa)`,
                    'JK': '',
                    'Kelas': cls.name,
                    'Hadir': classTotalPresent,
                    'Terlambat': classTotalLate,
                    'Sakit': classTotalSick,
                    'Izin': classTotalPermission,
                    'Absen': classTotalAbsent,
                    'Kehadiran (%)': `${classPct}%`,
                });
            }
            sheetName = 'Rekap Siswa';
        } else if (type === 'guru-class') {
            // Export guru per kelas - session-level detail
            const sessions = await Session.findAll({
                where: { date: { [Op.between]: [start, end] } },
                include: [
                    {
                        model: Schedule, as: 'schedule',
                        include: [
                            { model: Class, as: 'class', attributes: ['id', 'name'] },
                            { model: Subject, as: 'subject', attributes: ['id', 'name'] },
                            { model: Teacher, as: 'teacher', include: [{ model: User, as: 'user', attributes: ['name'] }] },
                        ],
                    },
                    { model: TeacherAttendance, as: 'teacherAttendance' },
                ],
                order: [['date', 'ASC'], ['startTime', 'ASC']],
            });

            for (const s of sessions as any[]) {
                const att = s.teacherAttendance?.[0];
                const statusLabel = att?.status === 'present' ? 'Hadir'
                    : att?.status === 'late' ? 'Terlambat'
                        : att?.status === 'absent' ? 'Absen'
                            : 'Tidak ada data';
                rows.push({
                    Tanggal: s.date,
                    'Jam Mulai': s.startTime?.substring(0, 5) || '-',
                    Kelas: s.schedule?.class?.name || '-',
                    'Mata Pelajaran': s.schedule?.subject?.name || '-',
                    Guru: s.schedule?.teacher?.user?.name || '-',
                    Status: statusLabel,
                    'Jam Masuk': att?.checkInTime?.substring(0, 5) || '-',
                    'Jam Keluar': att?.checkOutTime?.substring(0, 5) || '-',
                });
            }
            sheetName = 'Rekap Guru Per Kelas';
        } else {
            res.status(400).json({ error: 'Invalid export type' });
            return;
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=rekap_${type}_${start}_${end}.xlsx`);
        res.send(buffer);
    } catch (error) {
        console.error('exportAttendance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
