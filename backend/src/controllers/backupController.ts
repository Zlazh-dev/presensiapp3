import { Request, Response } from 'express';
import {
    User, Teacher, Class, Student, Subject, Schedule, Session,
    TeacherAttendance, StudentAttendance, ActivityLog, TimeSlot,
    HolidayEvent, TeacherWorkingHours, Geofence,
} from '../models';

/**
 * Full database backup — exports ALL tables as a JSON file download.
 * GET /api/admin/backup
 * @access Admin only
 */
export const backupAllData = async (_req: Request, res: Response): Promise<void> => {
    try {
        // Fetch all tables in parallel
        const [
            users,
            teachers,
            classes,
            students,
            subjects,
            schedules,
            sessions,
            teacherAttendance,
            studentAttendance,
            activityLogs,
            timeSlots,
            holidayEvents,
            teacherWorkingHours,
            geofences,
        ] = await Promise.all([
            User.findAll({ raw: true }),
            Teacher.findAll({ raw: true }),
            Class.findAll({ raw: true }),
            Student.findAll({ raw: true }),
            Subject.findAll({ raw: true }),
            Schedule.findAll({ raw: true }),
            Session.findAll({ raw: true }),
            TeacherAttendance.findAll({ raw: true }),
            StudentAttendance.findAll({ raw: true }),
            ActivityLog.findAll({ raw: true }),
            TimeSlot.findAll({ raw: true }),
            HolidayEvent.findAll({ raw: true }),
            TeacherWorkingHours.findAll({ raw: true }),
            Geofence.findAll({ raw: true }),
        ]);

        const backup = {
            metadata: {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                exportedBy: (_req as any).user?.name || 'admin',
                tables: {
                    users: users.length,
                    teachers: teachers.length,
                    classes: classes.length,
                    students: students.length,
                    subjects: subjects.length,
                    schedules: schedules.length,
                    sessions: sessions.length,
                    teacherAttendance: teacherAttendance.length,
                    studentAttendance: studentAttendance.length,
                    activityLogs: activityLogs.length,
                    timeSlots: timeSlots.length,
                    holidayEvents: holidayEvents.length,
                    teacherWorkingHours: teacherWorkingHours.length,
                    geofences: geofences.length,
                },
                totalRecords: users.length + teachers.length + classes.length +
                    students.length + subjects.length + schedules.length +
                    sessions.length + teacherAttendance.length + studentAttendance.length +
                    activityLogs.length + timeSlots.length + holidayEvents.length +
                    teacherWorkingHours.length + geofences.length,
            },
            data: {
                users,
                teachers,
                classes,
                students,
                subjects,
                schedules,
                sessions,
                teacherAttendance,
                studentAttendance,
                activityLogs,
                timeSlots,
                holidayEvents,
                teacherWorkingHours,
                geofences,
            },
        };

        // Generate filename with timestamp
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
        const filename = `backup_presensi_${dateStr}_${timeStr}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(JSON.stringify(backup, null, 2));
    } catch (error) {
        console.error('[backup] Error:', error);
        res.status(500).json({ error: 'Gagal membuat backup data' });
    }
};

/**
 * Get backup info (table counts only, without downloading).
 * GET /api/admin/backup/info
 * @access Admin only
 */
export const getBackupInfo = async (_req: Request, res: Response): Promise<void> => {
    try {
        const [
            users, teachers, classes, students, subjects,
            schedules, sessions, teacherAttendance, studentAttendance,
            activityLogs, timeSlots, holidayEvents, teacherWorkingHours, geofences,
        ] = await Promise.all([
            User.count(),
            Teacher.count(),
            Class.count(),
            Student.count(),
            Subject.count(),
            Schedule.count(),
            Session.count(),
            TeacherAttendance.count(),
            StudentAttendance.count(),
            ActivityLog.count(),
            TimeSlot.count(),
            HolidayEvent.count(),
            TeacherWorkingHours.count(),
            Geofence.count(),
        ]);

        const tables = [
            { name: 'Users', key: 'users', count: users, icon: 'users' },
            { name: 'Teachers', key: 'teachers', count: teachers, icon: 'teacher' },
            { name: 'Classes', key: 'classes', count: classes, icon: 'class' },
            { name: 'Students', key: 'students', count: students, icon: 'student' },
            { name: 'Subjects', key: 'subjects', count: subjects, icon: 'subject' },
            { name: 'Schedules', key: 'schedules', count: schedules, icon: 'schedule' },
            { name: 'Sessions', key: 'sessions', count: sessions, icon: 'session' },
            { name: 'Teacher Attendance', key: 'teacherAttendance', count: teacherAttendance, icon: 'attendance' },
            { name: 'Student Attendance', key: 'studentAttendance', count: studentAttendance, icon: 'attendance' },
            { name: 'Activity Logs', key: 'activityLogs', count: activityLogs, icon: 'log' },
            { name: 'Time Slots', key: 'timeSlots', count: timeSlots, icon: 'time' },
            { name: 'Holiday Events', key: 'holidayEvents', count: holidayEvents, icon: 'holiday' },
            { name: 'Working Hours', key: 'teacherWorkingHours', count: teacherWorkingHours, icon: 'hours' },
            { name: 'Geofences', key: 'geofences', count: geofences, icon: 'geo' },
        ];

        const totalRecords = tables.reduce((sum, t) => sum + t.count, 0);

        res.json({ tables, totalRecords });
    } catch (error) {
        console.error('[backup-info] Error:', error);
        res.status(500).json({ error: 'Gagal mengambil info backup' });
    }
};

/**
 * Restore database from a JSON backup file.
 * POST /api/admin/restore
 * @access Admin only
 * @body JSON backup file content
 */
export const restoreData = async (req: Request, res: Response): Promise<void> => {
    try {
        const backup = req.body;

        // Validate backup structure
        if (!backup || !backup.metadata || !backup.data) {
            res.status(400).json({ error: 'Format file backup tidak valid. Pastikan file berasal dari fitur Backup.' });
            return;
        }

        if (backup.metadata.version !== '1.0') {
            res.status(400).json({ error: `Versi backup tidak didukung: ${backup.metadata.version}` });
            return;
        }

        // Validate required data keys
        const requiredKeys = [
            'users', 'teachers', 'classes', 'students', 'subjects',
            'schedules', 'sessions', 'teacherAttendance', 'studentAttendance',
            'activityLogs', 'timeSlots', 'holidayEvents', 'teacherWorkingHours', 'geofences',
        ];
        const missingKeys = requiredKeys.filter(k => !backup.data[k] || !Array.isArray(backup.data[k]));
        if (missingKeys.length > 0) {
            res.status(400).json({
                error: `Data backup tidak lengkap. Tabel yang hilang: ${missingKeys.join(', ')}`,
            });
            return;
        }

        // Confirm text validation
        if (backup.confirmText !== 'RESTORE DATA') {
            res.status(400).json({ error: 'Konfirmasi tidak valid. Ketik "RESTORE DATA" untuk melanjutkan.' });
            return;
        }

        const sequelize = User.sequelize!;
        const t = await sequelize.transaction();

        try {
            // Delete in reverse dependency order (children first)
            await StudentAttendance.destroy({ where: {}, transaction: t });
            await TeacherAttendance.destroy({ where: {}, transaction: t });
            await ActivityLog.destroy({ where: {}, transaction: t });
            await Session.destroy({ where: {}, transaction: t });
            await Schedule.destroy({ where: {}, transaction: t });
            await TeacherWorkingHours.destroy({ where: {}, transaction: t });
            await HolidayEvent.destroy({ where: {}, transaction: t });
            await Student.destroy({ where: {}, transaction: t });
            await Class.destroy({ where: {}, transaction: t });
            await Subject.destroy({ where: {}, transaction: t });
            await Teacher.destroy({ where: {}, transaction: t });
            await User.destroy({ where: {}, transaction: t });
            await TimeSlot.destroy({ where: {}, transaction: t });
            await Geofence.destroy({ where: {}, transaction: t });

            // Insert in dependency order (parents first)
            const counts: Record<string, number> = {};

            if (backup.data.users.length > 0) {
                await User.bulkCreate(backup.data.users, { transaction: t, ignoreDuplicates: true });
                counts.users = backup.data.users.length;
            }
            if (backup.data.teachers.length > 0) {
                await Teacher.bulkCreate(backup.data.teachers, { transaction: t, ignoreDuplicates: true });
                counts.teachers = backup.data.teachers.length;
            }
            if (backup.data.classes.length > 0) {
                await Class.bulkCreate(backup.data.classes, { transaction: t, ignoreDuplicates: true });
                counts.classes = backup.data.classes.length;
            }
            if (backup.data.students.length > 0) {
                await Student.bulkCreate(backup.data.students, { transaction: t, ignoreDuplicates: true });
                counts.students = backup.data.students.length;
            }
            if (backup.data.subjects.length > 0) {
                await Subject.bulkCreate(backup.data.subjects, { transaction: t, ignoreDuplicates: true });
                counts.subjects = backup.data.subjects.length;
            }
            if (backup.data.schedules.length > 0) {
                await Schedule.bulkCreate(backup.data.schedules, { transaction: t, ignoreDuplicates: true });
                counts.schedules = backup.data.schedules.length;
            }
            if (backup.data.sessions.length > 0) {
                await Session.bulkCreate(backup.data.sessions, { transaction: t, ignoreDuplicates: true });
                counts.sessions = backup.data.sessions.length;
            }
            if (backup.data.teacherAttendance.length > 0) {
                await TeacherAttendance.bulkCreate(backup.data.teacherAttendance, { transaction: t, ignoreDuplicates: true });
                counts.teacherAttendance = backup.data.teacherAttendance.length;
            }
            if (backup.data.studentAttendance.length > 0) {
                await StudentAttendance.bulkCreate(backup.data.studentAttendance, { transaction: t, ignoreDuplicates: true });
                counts.studentAttendance = backup.data.studentAttendance.length;
            }
            if (backup.data.activityLogs.length > 0) {
                await ActivityLog.bulkCreate(backup.data.activityLogs, { transaction: t, ignoreDuplicates: true });
                counts.activityLogs = backup.data.activityLogs.length;
            }
            if (backup.data.timeSlots.length > 0) {
                await TimeSlot.bulkCreate(backup.data.timeSlots, { transaction: t, ignoreDuplicates: true });
                counts.timeSlots = backup.data.timeSlots.length;
            }
            if (backup.data.holidayEvents.length > 0) {
                await HolidayEvent.bulkCreate(backup.data.holidayEvents, { transaction: t, ignoreDuplicates: true });
                counts.holidayEvents = backup.data.holidayEvents.length;
            }
            if (backup.data.teacherWorkingHours.length > 0) {
                await TeacherWorkingHours.bulkCreate(backup.data.teacherWorkingHours, { transaction: t, ignoreDuplicates: true });
                counts.teacherWorkingHours = backup.data.teacherWorkingHours.length;
            }
            if (backup.data.geofences.length > 0) {
                await Geofence.bulkCreate(backup.data.geofences, { transaction: t, ignoreDuplicates: true });
                counts.geofences = backup.data.geofences.length;
            }

            await t.commit();

            const totalInserted = Object.values(counts).reduce((sum, c) => sum + c, 0);

            res.json({
                success: true,
                message: `Restore berhasil! ${totalInserted} record telah diimport.`,
                counts,
                restoredFrom: backup.metadata.exportedAt,
            });
        } catch (insertError) {
            await t.rollback();
            console.error('[restore] Transaction error:', insertError);
            res.status(500).json({
                error: 'Restore gagal. Semua perubahan telah dibatalkan (rollback).',
                detail: (insertError as Error).message,
            });
        }
    } catch (error) {
        console.error('[restore] Error:', error);
        res.status(500).json({ error: 'Gagal memproses file restore' });
    }
};
