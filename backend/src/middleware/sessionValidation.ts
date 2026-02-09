import { Request, Response, NextFunction } from 'express';
import { sessionManager } from '../services/SessionManager';

/**
 * Extended Request interface with teacher info
 */
interface AuthenticatedRequest extends Request {
    teacher?: {
        id: number;
        userId: number;
        name: string;
    };
    user?: {
        id: number;
        role: string;
    };
}

/**
 * Middleware to validate that teacher has no active session
 * Use before check-in operations to prevent multiple sessions
 */
export const validateNoActiveSession = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const teacherId = req.teacher?.id;

        if (!teacherId) {
            return res.status(401).json({ error: 'Teacher not authenticated' });
        }

        const activeSession = await sessionManager.hasActiveSession(teacherId);

        if (activeSession) {
            return res.status(409).json({
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
        }

        next();
    } catch (error) {
        console.error('[validateNoActiveSession] Error:', error);
        return res.status(500).json({ error: 'Session validation failed' });
    }
};

/**
 * Middleware to validate session ownership
 * Ensures the teacher owns the session they're trying to modify
 */
export const validateSessionOwnership = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const teacherId = req.teacher?.id;
        const sessionId = parseInt(req.params.sessionId || req.body.sessionId);

        if (!teacherId) {
            return res.status(401).json({ error: 'Teacher not authenticated' });
        }

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        // Check if teacher owns this session (either as primary or substitute)
        const { Session, Schedule } = await import('../models');

        const session = await Session.findByPk(sessionId, {
            include: [{ model: Schedule, as: 'schedule' }]
        });

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const schedule = (session as any).schedule;
        const isOwner = schedule?.teacherId === teacherId;
        const isSubstitute = session.substituteTeacherId === teacherId;

        if (!isOwner && !isSubstitute) {
            return res.status(403).json({
                error: 'Anda tidak memiliki akses ke sesi ini',
                code: 'SESSION_ACCESS_DENIED'
            });
        }

        // Attach session to request for downstream use
        (req as any).session = session;
        next();
    } catch (error) {
        console.error('[validateSessionOwnership] Error:', error);
        return res.status(500).json({ error: 'Session ownership validation failed' });
    }
};

/**
 * Middleware to validate that check-in hasn't been done yet
 */
export const validateNoExistingCheckIn = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const teacherId = req.teacher?.id;
        const sessionId = parseInt(req.params.sessionId || req.body.sessionId);

        if (!teacherId || !sessionId) {
            return res.status(400).json({ error: 'Teacher ID and Session ID required' });
        }

        const { TeacherAttendance } = await import('../models');

        const existingAttendance = await TeacherAttendance.findOne({
            where: {
                teacherId,
                sessionId,
                checkInTime: { [require('sequelize').Op.ne]: null }
            }
        });

        if (existingAttendance) {
            return res.status(409).json({
                error: 'Anda sudah check-in untuk sesi ini',
                code: 'ALREADY_CHECKED_IN',
                checkInTime: existingAttendance.checkInTime
            });
        }

        next();
    } catch (error) {
        console.error('[validateNoExistingCheckIn] Error:', error);
        return res.status(500).json({ error: 'Check-in validation failed' });
    }
};
