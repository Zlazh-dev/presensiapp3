import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { TeacherWorkingHours, TeacherAttendance, Teacher, Geofence } from '../models';
import { calculateDistance } from '../utils/geofence';
import { getIO } from '../socket';

// ─── Jakarta timezone helper ───────────────────────────
function getJakartaNow() {
    const now = new Date();
    const jakartaStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    return new Date(jakartaStr);
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

// ─────────────────────────────────────────────────────
// GET /api/qr/guru-room
// Returns a single static QR data URL encoding "guru-room"
// This QR is printed once and placed in the teacher room.
// ─────────────────────────────────────────────────────
export const generateGuruRoomQR = async (_req: Request, res: Response): Promise<void> => {
    try {
        const payload = JSON.stringify({ type: 'guru-room' });
        const qrDataUrl = await QRCode.toDataURL(payload, {
            width: 400,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' },
        });

        res.json({
            qrCode: qrDataUrl,
            payload,
            label: 'QR Ruang Guru',
            description: 'Tempel di ruang guru. Semua guru scan QR ini untuk check-in / check-out.',
        });
    } catch (error) {
        console.error('Generate guru room QR error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─────────────────────────────────────────────────────
// POST /api/attendance/guru-regular-scan
// Body: { qrData: string }   (the scanned QR payload)
// Auth: teacher JWT (teacherId from token)
//
// Auto-detects checkin vs checkout:
//   - No attendance today => checkin  (validates window)
//   - Has checkin, no checkout => checkout (no window needed)
//   - Both exist => already done
//
// Checkin window:
//   [startTime - toleranceBeforeMin, startTime + lateAfterMin + 15]
//   "present" if before startTime + lateAfterMin
//   "late"    if after, lateMinutes = diff from startTime
// ─────────────────────────────────────────────────────
export const scanGuruRegular = async (req: Request, res: Response): Promise<void> => {
    try {
        const { qrData, lat, lng } = req.body;

        // 1. Validate QR payload
        let parsed: any;
        try {
            parsed = JSON.parse(qrData || '{}');
        } catch {
            res.status(400).json({ error: 'QR tidak valid' });
            return;
        }
        if (parsed.type !== 'guru-room') {
            res.status(400).json({ error: 'Bukan QR Ruang Guru' });
            return;
        }

        // 1b. Validate geolocation
        if (lat === undefined || lng === undefined) {
            res.status(400).json({ error: 'Lokasi GPS diperlukan. Aktifkan GPS dan izinkan akses lokasi.' });
            return;
        }

        // 1c. Check geofence
        const geofence = await Geofence.findOne({ where: { isActive: true } });
        if (geofence) {
            const distance = calculateDistance(
                Number(lat), Number(lng),
                Number(geofence.latitude), Number(geofence.longitude)
            );
            if (distance > geofence.radiusMeters) {
                res.status(400).json({
                    error: `Di luar area geofence (${Math.round(distance)}m dari titik sekolah, max ${geofence.radiusMeters}m)`,
                    distance: Math.round(distance),
                    radiusMeters: geofence.radiusMeters,
                    geofenceLabel: geofence.label,
                });
                return;
            }
        }

        // 2. Get teacherId from authenticated user
        const authUser = (req as any).user;
        if (!authUser) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Find the teacher record for this user
        const teacher = await Teacher.findOne({ where: { userId: authUser.id } });
        if (!teacher) {
            res.status(403).json({ error: 'Anda bukan guru terdaftar' });
            return;
        }
        const teacherId = teacher.id;

        // 3. Determine today (Jakarta)
        const now = getJakartaNow();
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon..7=Sun
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const nowMins = now.getHours() * 60 + now.getMinutes();

        // 4. Check working hours for today
        const wh = await TeacherWorkingHours.findOne({
            where: { teacherId, dayOfWeek },
        });
        if (!wh) {
            res.status(400).json({ error: 'Hari ini bukan hari kerja Anda' });
            return;
        }

        const startMins = timeToMinutes(wh.startTime);
        const endMins = timeToMinutes(wh.endTime);
        const toleranceBefore = wh.toleranceBeforeMin ?? 30;
        const lateAfterMin = wh.lateAfterMin ?? 5;

        // 5. Check existing attendance
        const existing = await TeacherAttendance.findOne({
            where: { teacherId, date: todayStr },
        });

        // ── AUTO-DETECT: checkin or checkout ──
        if (!existing || !existing.checkInTime) {
            // === CHECKIN ===
            const windowOpen = startMins - toleranceBefore;
            const windowClose = startMins + lateAfterMin + 15; // 15min grace after late threshold

            if (nowMins < windowOpen) {
                res.status(400).json({
                    error: `Terlalu awal. Check-in dibuka pukul ${minutesToTime(windowOpen)}`,
                    windowStart: minutesToTime(windowOpen),
                    windowEnd: minutesToTime(windowClose),
                });
                return;
            }
            if (nowMins > windowClose) {
                res.status(400).json({
                    error: `Sudah lewat batas waktu check-in (${minutesToTime(windowClose)})`,
                    windowStart: minutesToTime(windowOpen),
                    windowEnd: minutesToTime(windowClose),
                });
                return;
            }

            // Determine status + lateMinutes
            const lateThreshold = startMins + lateAfterMin;
            let status: 'present' | 'late' = 'present';
            let lateMinutes: number | undefined = undefined;

            if (nowMins > lateThreshold) {
                status = 'late';
                lateMinutes = nowMins - startMins;
            }

            const checkInTime = minutesToTime(nowMins);

            if (existing) {
                await existing.update({ checkInTime, status, lateMinutes: lateMinutes ?? null } as any);
            } else {
                await TeacherAttendance.create({
                    teacherId,
                    date: todayStr,
                    checkInTime,
                    status,
                    lateMinutes,
                } as any);
            }

            const statusLabel = status === 'late'
                ? `Telat ${lateMinutes} menit`
                : 'Tepat waktu';

            res.json({
                message: 'Check-in berhasil',
                action: 'checkin',
                teacherId,
                date: todayStr,
                checkInTime,
                status,
                lateMinutes,
                statusLabel,
                schedule: {
                    startTime: wh.startTime,
                    endTime: wh.endTime,
                    toleranceBeforeMin: toleranceBefore,
                    lateAfterMin,
                },
            });

            // Emit checkin event for real-time dashboards
            try {
                getIO().emit('teacher:checkin', {
                    teacherId,
                    name: (authUser as any).name || 'Guru',
                    checkInTime
                });
            } catch (e) {
                console.error('Socket emit checkin error:', e);
            }

        } else if (!existing.checkOutTime) {
            // === CHECKOUT with 10-minute tolerance ===
            const toleranceCheckout = 10;
            const earliestCheckout = endMins - toleranceCheckout;

            if (nowMins < earliestCheckout) {
                res.status(400).json({
                    error: `Belum waktunya checkout. Checkout dibuka pukul ${minutesToTime(earliestCheckout)} (10 menit sebelum jam pulang ${minutesToTime(endMins)})`,
                    earliestCheckout: minutesToTime(earliestCheckout),
                    endTime: minutesToTime(endMins),
                });
                return;
            }

            let earlyCheckoutMinutes: number | null = null;
            if (nowMins < endMins) {
                earlyCheckoutMinutes = endMins - nowMins;
            }

            const checkOutTime = minutesToTime(nowMins);
            await existing.update({
                checkOutTime,
                earlyCheckoutMinutes,
            } as any);

            const checkoutLabel = earlyCheckoutMinutes
                ? `Checkout lebih awal ${earlyCheckoutMinutes} menit`
                : 'Checkout tepat waktu';

            res.json({
                message: 'Check-out berhasil',
                action: 'checkout',
                teacherId,
                date: todayStr,
                checkInTime: existing.checkInTime,
                checkOutTime,
                status: existing.status,
                lateMinutes: existing.lateMinutes,
                earlyCheckoutMinutes,
                checkoutLabel,
            });

            // Emit checkout event for real-time dashboards
            try {
                getIO().emit('teacher:checkout', {
                    teacherId,
                    name: (authUser as any).name || 'Guru',
                    checkOutTime
                });
            } catch (e) {
                console.error('Socket emit checkout error:', e);
            }

        } else {
            // === ALREADY DONE ===
            res.status(400).json({
                error: 'Anda sudah check-in dan check-out hari ini',
                checkInTime: existing.checkInTime,
                checkOutTime: existing.checkOutTime,
            });
        }

    } catch (error) {
        console.error('Guru regular scan error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─────────────────────────────────────────────────────
// GET /api/attendance/guru-today
// Returns today's attendance record for the authenticated teacher
// ─────────────────────────────────────────────────────
export const getGuruToday = async (req: Request, res: Response): Promise<void> => {
    try {
        const authUser = (req as any).user;
        if (!authUser) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const teacher = await Teacher.findOne({ where: { userId: authUser.id } });
        if (!teacher) {
            res.json({ attendance: null });
            return;
        }

        const now = getJakartaNow();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const attendance = await TeacherAttendance.findOne({
            where: { teacherId: teacher.id, date: todayStr },
        });

        // Also return today's working hours schedule
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
        const schedule = await TeacherWorkingHours.findOne({
            where: { teacherId: teacher.id, dayOfWeek },
        });

        res.json({
            attendance: attendance || null,
            schedule: schedule
                ? {
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    toleranceBeforeMin: schedule.toleranceBeforeMin,
                    lateAfterMin: schedule.lateAfterMin,
                }
                : null,
        });
    } catch (error) {
        console.error('Get guru today error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
