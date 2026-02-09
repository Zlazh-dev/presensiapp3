import { getIO } from '../socket';
import { Session, Schedule, TeacherAttendance } from '../models';
import { Op } from 'sequelize';
import { getJakartaNow } from '../utils/date';

export const checkSessionTimings = async () => {
    const io = getIO();
    const sessionsNamespace = io.of('/sessions');

    try {
        const now = getJakartaNow();
        const dateStr = now.toISOString().split('T')[0];

        // Find all active sessions for today (scheduled or ongoing)
        const sessions = await Session.findAll({
            where: {
                date: dateStr,
                status: {
                    [Op.in]: ['scheduled', 'ongoing']
                }
            },
            include: [{
                model: Schedule,
                as: 'schedule'
            }]
        });

        const tenMinMs = 10 * 60 * 1000;
        const nowTime = now.getTime();

        for (const session of sessions) {
            const sAny = session as any;
            // Determine active times
            const startTimeStr = session.startTime || sAny.schedule?.startTime;
            const endTimeStr = session.endTime || sAny.schedule?.endTime;

            if (!startTimeStr || !endTimeStr) continue;

            const startT = new Date(`${dateStr}T${startTimeStr}`);
            const endT = new Date(`${dateStr}T${endTimeStr}`);

            // Calc canCheckIn
            const minutesUntilCheckIn = Math.ceil((startT.getTime() - tenMinMs - nowTime) / 60000);
            const canCheckIn = minutesUntilCheckIn <= 0;

            // Calc canCheckOut (Strict: can only checkout after end time OR based on tolerance)
            // For now assuming strictly after endTime
            const minutesUntilCheckOut = Math.ceil((endT.getTime() - nowTime) / 60000);
            const canCheckOut = minutesUntilCheckOut <= 0;

            // Emit update to this session's room
            // Clients listening in 'session-{id}' will get this
            sessionsNamespace.to(`session-${session.id}`).emit('session:time-update', {
                sessionId: session.id,
                minutesUntilCheckIn,
                minutesUntilCheckOut, // actually minutes remaining in class
                canCheckIn,
                canCheckOut,
                status: session.status
            });

            // Also check if we need to auto-activate or close? 
            // Usually we rely on teacher action, but we could auto-close if very late.
            // For now, just emitting time updates is enough for the frontend to react.
        }

    } catch (error) {
        console.error('Error in session time checker:', error);
    }
};
