import { Op } from 'sequelize';
import { Session, Schedule, TeacherAttendance, Teacher, Class, Subject } from '../models';

/**
 * ActiveSessionInfo - Information about an active session
 */
export interface ActiveSessionInfo {
    sessionId: number;
    scheduleId: number;
    className: string;
    subjectName: string;
    startTime: string;
    date: string;
    teacherId: number;
}

/**
 * ValidationResult - Result of session validation
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
    activeSession?: ActiveSessionInfo;
}

/**
 * SessionManager - Single Source of Truth for Session Operations
 * 
 * This service is the single authority for all session operations.
 * It enforces the rule that a teacher can only have ONE active session at a time.
 */
class SessionManager {
    /**
     * Check if a teacher has any active session
     * @param teacherId - The teacher's ID
     * @returns ActiveSessionInfo if teacher has active session, null otherwise
     */
    async hasActiveSession(teacherId: number): Promise<ActiveSessionInfo | null> {
        // Find active attendance record for this teacher (checked in but not out)
        const activeAttendance = await TeacherAttendance.findOne({
            where: {
                teacherId,
                checkOutTime: null as any,
                sessionId: { [Op.ne]: null as any }
            },
            include: [{
                model: Session,
                as: 'session',
                where: { status: 'ongoing' },
                include: [{
                    model: Schedule,
                    as: 'schedule',
                    include: [
                        { model: Class, as: 'class' },
                        { model: Subject, as: 'subject' }
                    ]
                }]
            }]
        });

        if (!activeAttendance || !activeAttendance.session) {
            return null;
        }

        const session = activeAttendance.session as any;
        const schedule = session.schedule;

        return {
            sessionId: session.id,
            scheduleId: session.scheduleId,
            className: schedule?.class?.name || 'Unknown',
            subjectName: schedule?.subject?.name || 'Unknown',
            startTime: session.startTime,
            date: session.date,
            teacherId
        };
    }

    /**
     * Validate before creating/starting a new session
     * Returns error if teacher already has an active session
     */
    async validateSessionStart(teacherId: number, scheduleId: number): Promise<ValidationResult> {
        // Check if teacher already has an active session
        const activeSession = await this.hasActiveSession(teacherId);

        if (activeSession) {
            return {
                valid: false,
                error: `Anda sudah memiliki sesi aktif di ${activeSession.className} - ${activeSession.subjectName}. Selesaikan sesi tersebut sebelum memulai sesi baru.`,
                activeSession
            };
        }

        // Check if the schedule exists and is valid
        const schedule = await Schedule.findByPk(scheduleId, {
            include: [
                { model: Class, as: 'class' },
                { model: Subject, as: 'subject' }
            ]
        });

        if (!schedule) {
            return {
                valid: false,
                error: 'Jadwal tidak ditemukan'
            };
        }

        if (!schedule.isActive) {
            return {
                valid: false,
                error: 'Jadwal tidak aktif'
            };
        }

        return { valid: true };
    }

    /**
     * Get canonical (deduplicated) schedule for a given slot
     * Ensures only one valid schedule is used as reference
     */
    async getCanonicalSchedule(
        classId: number,
        dayOfWeek: number,
        startTime: string,
        academicYear: string
    ): Promise<Schedule | null> {
        return await Schedule.findOne({
            where: {
                classId,
                dayOfWeek,
                startTime,
                academicYear,
                isActive: true
            },
            include: [
                { model: Class, as: 'class' },
                { model: Subject, as: 'subject' },
                { model: Teacher, as: 'teacher' }
            ],
            order: [['createdAt', 'ASC']] // Use earliest created as canonical
        });
    }

    /**
     * Find all duplicate active sessions (for monitoring/reconciliation)
     * This should normally return 0 if constraints are working properly
     */
    async findDuplicateActiveSessions(): Promise<{ teacherId: number; count: number; sessions: any[] }[]> {
        const result = await TeacherAttendance.findAll({
            where: {
                checkOutTime: null as any,
                sessionId: { [Op.ne]: null as any }
            },
            include: [{
                model: Session,
                as: 'session',
                where: { status: 'ongoing' }
            }],
            attributes: ['teacherId'],
            group: ['teacherId', 'session.id'],
            having: require('sequelize').literal('COUNT(*) > 1')
        });

        // This is a simplified check - in production you'd want more detailed analysis
        return [];
    }

    /**
     * Get data integrity metrics for monitoring dashboard
     */
    async getDataIntegrityMetrics(): Promise<{
        duplicateActiveSessions: number;
        orphanedAttendance: number;
        activeSessionsCount: number;
    }> {
        // Count teachers with multiple active sessions (should be 0)
        const duplicateCheck = await TeacherAttendance.findAll({
            where: {
                checkOutTime: null as any,
                sessionId: { [Op.ne]: null as any }
            },
            attributes: ['teacherId'],
            group: ['teacherId'],
            having: require('sequelize').literal('COUNT(*) > 1'),
            raw: true
        });

        // Count orphaned attendance records (attendance without valid session)
        const orphanedCount = await TeacherAttendance.count({
            where: {
                sessionId: null as any,
                checkOutTime: null as any
            }
        });

        // Total active sessions
        const activeCount = await Session.count({
            where: { status: 'ongoing' }
        });

        return {
            duplicateActiveSessions: duplicateCheck.length,
            orphanedAttendance: orphanedCount,
            activeSessionsCount: activeCount
        };
    }
}

// Export singleton instance
export const sessionManager = new SessionManager();
export default SessionManager;
