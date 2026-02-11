import { getIO } from '../socket';
import { Session, Schedule, TeacherAttendance } from '../models';
import { Op } from 'sequelize';
import { getJakartaNow } from '../utils/date';

/** Minutes past endTime before auto-closing an ongoing session */
const AUTO_CLOSE_GRACE_MINUTES = 15;

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

            // Calc canCheckOut
            const minutesUntilCheckOut = Math.ceil((endT.getTime() - nowTime) / 60000);
            const canCheckOut = minutesUntilCheckOut <= 0;

            // === AUTO-CLOSE: If ongoing and past grace period, auto-checkout ===
            if (session.status === 'ongoing') {
                const minutesPastEnd = Math.floor((nowTime - endT.getTime()) / 60000);

                if (minutesPastEnd >= AUTO_CLOSE_GRACE_MINUTES) {
                    console.log(`🔒 [AUTO-CHECKOUT] Session ${session.id} is ${minutesPastEnd}min past endTime. Auto-closing...`);

                    // Set session to completed with planned end time
                    await session.update({
                        status: 'completed',
                        endTime: endTimeStr,
                    });

                    // Update TeacherAttendance: fill checkOutTime for any open attendance
                    const [updatedCount] = await TeacherAttendance.update(
                        {
                            checkOutTime: endTimeStr,
                            notes: '[AUTO-CHECKOUT] Sesi ditutup otomatis karena melewati waktu berakhir',
                        },
                        {
                            where: {
                                sessionId: session.id,
                                checkOutTime: null as any,
                            },
                        }
                    );

                    console.log(`   ✅ Session ${session.id} auto-closed. ${updatedCount} attendance record(s) updated.`);

                    // Emit socket event so frontend updates in real-time
                    sessionsNamespace.to(`session-${session.id}`).emit('session:status-changed', {
                        sessionId: session.id,
                        status: 'completed',
                        checkOutTime: endTimeStr,
                        autoCheckout: true,
                        timestamp: new Date(),
                    });

                    io.emit('teacher:checkout', {
                        sessionId: session.id,
                        autoCheckout: true,
                        timestamp: new Date(),
                    });

                    continue; // Skip emitting time-update for this session
                }
            }

            // Emit time update for active sessions
            sessionsNamespace.to(`session-${session.id}`).emit('session:time-update', {
                sessionId: session.id,
                minutesUntilCheckIn,
                minutesUntilCheckOut,
                canCheckIn,
                canCheckOut,
                status: session.status
            });
        }

    } catch (error) {
        console.error('Error in session time checker:', error);
    }
};
