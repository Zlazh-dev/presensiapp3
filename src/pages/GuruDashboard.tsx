import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
    MapPin, RefreshCw, Camera, CameraOff, Upload, CheckCircle, XCircle,
    Loader2, LogIn, LogOut as LogOutIcon,
    Wifi, WifiOff, ScanLine, Clock, Lock, AlertTriangle,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

// ─── Types ────────────────────────────────────────────
interface GeofenceStatus {
    inside: boolean;
    distance: number;
    radiusMeters: number;
    label: string;
}

interface AttendanceToday {
    id: number;
    date: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    status: string;
}

interface TeacherSchedule {
    startTime: string; // "HH:MM"
    endTime: string;   // "HH:MM"
    toleranceBeforeMin: number;
    lateAfterMin: number;
}

interface CheckoutWindowInfo {
    canCheckout: boolean;
    toleranceStart: Date | null;
    checkoutEnd: Date | null;
    minutesUntil: number; // minutes until tolerance window opens
}

// ─── Component ───────────────────────────────────────
const GuruDashboard: React.FC = () => {
    const { user } = useAuth();

    // Geofence
    const [geoStatus, setGeoStatus] = useState<GeofenceStatus | null>(null);
    const [geoLoading, setGeoLoading] = useState(true);
    const [geoError, setGeoError] = useState('');
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const geoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // QR Scanner
    const [scanTab, setScanTab] = useState<'camera' | 'upload'>('camera');
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Camera permission + lifecycle
    type CameraPermission = 'unknown' | 'checking' | 'granted' | 'denied' | 'no-camera' | 'error';
    const [cameraPermission, setCameraPermission] = useState<CameraPermission>('unknown');
    const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
    const [cameraError, setCameraError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    const [scannerTrigger, setScannerTrigger] = useState(0); // increment to force scanner restart
    const html5QrRef = useRef<Html5Qrcode | null>(null);
    const cameraRequestInProgress = useRef(false);
    const handleScanResultRef = useRef<(qr: string) => void>(() => { });



    // Attendance today
    const [todayAttendance, setTodayAttendance] = useState<AttendanceToday | null>(null);
    const [attendanceLoading, setAttendanceLoading] = useState(true);

    // Schedule + checkout window
    const [schedule, setSchedule] = useState<TeacherSchedule | null>(null);
    const [checkoutWindow, setCheckoutWindow] = useState<CheckoutWindowInfo>({
        canCheckout: false,
        toleranceStart: null,
        checkoutEnd: null,
        minutesUntil: 0,
    });

    // ─── Checkout time calculation helpers ───
    const getCheckoutTimes = useCallback((sched: TeacherSchedule): { toleranceStart: Date; checkoutEnd: Date } => {
        const now = new Date();
        const [endH, endM] = sched.endTime.split(':').map(Number);
        const [startH] = sched.startTime.split(':').map(Number);

        // Build checkout time (endTime) for today
        const checkoutEnd = new Date(now);
        checkoutEnd.setHours(endH, endM, 0, 0);

        // Cross-day detection: if endTime hour < startTime hour,
        // checkout is the next calendar day (e.g., start 21:00, end 03:00)
        if (endH < startH) {
            // If it's currently before the start time (e.g., it's 02:00 and start was 21:00 yesterday)
            // then checkout is TODAY (the "next day" from yesterday's perspective)
            // If it's after start time (e.g., it's 22:00), checkout is TOMORROW
            if (now.getHours() >= startH) {
                checkoutEnd.setDate(checkoutEnd.getDate() + 1);
            }
            // else: checkout is already today (we're in the early morning after midnight)
        }

        // Tolerance: 10 minutes before checkout end
        const toleranceStart = new Date(checkoutEnd.getTime() - 10 * 60 * 1000);

        return { toleranceStart, checkoutEnd };
    }, []);

    const computeCheckoutEligibility = useCallback(
        (attendance: AttendanceToday | null, sched: TeacherSchedule | null): CheckoutWindowInfo => {
            if (!attendance?.checkInTime || !sched) {
                return { canCheckout: false, toleranceStart: null, checkoutEnd: null, minutesUntil: 0 };
            }

            // Already checked out
            if (attendance.checkOutTime) {
                return { canCheckout: false, toleranceStart: null, checkoutEnd: null, minutesUntil: 0 };
            }

            const { toleranceStart, checkoutEnd } = getCheckoutTimes(sched);
            const now = new Date();
            const eligible = now >= toleranceStart;
            const minutesUntil = eligible ? 0 : Math.ceil((toleranceStart.getTime() - now.getTime()) / 60000);

            return { canCheckout: eligible, toleranceStart, checkoutEnd, minutesUntil };
        },
        [getCheckoutTimes]
    );

    // ─── Fetch attendance status ───
    const fetchAttendanceToday = useCallback(async () => {
        try {
            const res = await api.get('/attendance/guru-today');
            const att = res.data.attendance || null;
            const sched = res.data.schedule || null;
            setTodayAttendance(att);
            setSchedule(sched);
            setCheckoutWindow(computeCheckoutEligibility(att, sched));
        } catch {
            // Endpoint might not exist yet, that's OK
            setTodayAttendance(null);
            setSchedule(null);
        } finally {
            setAttendanceLoading(false);
        }
    }, [computeCheckoutEligibility]);

    // ─── Geolocation polling ───
    const checkGeofence = useCallback(async (lat: number, lng: number) => {
        try {
            const res = await api.get(`/geofence/status?lat=${lat}&lng=${lng}`);
            setGeoStatus(res.data);
            setGeoError('');
        } catch {
            setGeoError('Gagal memeriksa geofence');
        }
    }, []);

    const requestLocation = useCallback(() => {
        setGeoLoading(true);
        if (!navigator.geolocation) {
            setGeoError('Geolocation tidak didukung');
            setGeoLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCoords(c);
                checkGeofence(c.lat, c.lng);
                setGeoLoading(false);
            },
            (err) => {
                setGeoError(`GPS error: ${err.message}`);
                setGeoLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, [checkGeofence]);

    // Start polling — every 10 minutes
    useEffect(() => {
        requestLocation();
        geoIntervalRef.current = setInterval(requestLocation, 10 * 60 * 1000);
        return () => {
            if (geoIntervalRef.current) {
                clearInterval(geoIntervalRef.current);
                geoIntervalRef.current = null;
            }
        };
    }, [requestLocation]);

    useEffect(() => {
        fetchAttendanceToday();
    }, [fetchAttendanceToday]);

    // ─── Real-time checkout eligibility check (every 60s) ───
    useEffect(() => {
        // Only run interval when teacher has checked in but not checked out
        if (!todayAttendance?.checkInTime || todayAttendance?.checkOutTime || !schedule) return;

        const checkEligibility = () => {
            setCheckoutWindow(computeCheckoutEligibility(todayAttendance, schedule));
        };

        const interval = setInterval(checkEligibility, 60_000);
        return () => clearInterval(interval);
    }, [todayAttendance, schedule, computeCheckoutEligibility]);

    // ─── QR Scan handler ───
    const handleScanResult = useCallback(async (qrData: string) => {
        if (!coords) {
            setScanResult({ success: false, message: 'Lokasi GPS belum tersedia' });
            return;
        }
        setScanning(true);
        setScanResult(null);
        try {
            const res = await api.post('/attendance/guru-regular-scan', {
                qrData,
                lat: coords.lat,
                lng: coords.lng,
            });
            setScanResult({
                success: true,
                message: res.data.message || (res.data.action === 'checkin' ? 'Check-in berhasil!' : 'Check-out berhasil!'),
            });
            fetchAttendanceToday();
        } catch (err: any) {
            const msg = err.response?.data?.error || err.message || 'Scan gagal';
            setScanResult({ success: false, message: msg });
        } finally {
            setScanning(false);
        }
    }, [coords, fetchAttendanceToday]);

    // Keep ref in sync so scanner effect doesn't depend on handleScanResult identity
    handleScanResultRef.current = handleScanResult;

    // ─── Camera permission flow ───
    const requestCameraAccess = useCallback(async () => {
        if (cameraRequestInProgress.current) return;
        cameraRequestInProgress.current = true;
        setCameraPermission('checking');
        setCameraError('');

        try {
            // 1. Check browser support
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraPermission('no-camera');
                setCameraError('Browser tidak mendukung akses kamera. Gunakan Chrome atau Safari terbaru.');
                return;
            }

            // 2. Check HTTPS (camera requires secure context)
            if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
                setCameraPermission('error');
                setCameraError('Kamera memerlukan koneksi HTTPS yang aman.');
                return;
            }

            // 3. Single getUserMedia call — back camera preference (soft constraint)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
            });

            // Immediately release — we only needed to confirm permission
            stream.getTracks().forEach(t => t.stop());

            // 4. Enumerate cameras now that permission is granted (labels available)
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices
                .filter(d => d.kind === 'videoinput')
                .map((d, i) => ({ id: d.deviceId, label: d.label || `Kamera ${i + 1}` }));

            setAvailableCameras(cameras);

            if (cameras.length === 0) {
                setCameraPermission('no-camera');
                setCameraError('Tidak ada kamera terdeteksi pada perangkat ini.');
                return;
            }

            setCameraPermission('granted');
            setRetryCount(0);
        } catch (err: any) {
            const name = err.name || '';
            if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
                setCameraPermission('denied');
            } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
                setCameraPermission('no-camera');
                setCameraError('Kamera tidak ditemukan pada perangkat ini.');
            } else if (name === 'NotReadableError' || name === 'TrackStartError') {
                setCameraPermission('error');
                setCameraError('Kamera sedang digunakan aplikasi lain. Tutup aplikasi lain dan coba lagi.');
            } else {
                setCameraPermission('error');
                setCameraError(err.message || 'Gagal mengakses kamera.');
            }
        } finally {
            cameraRequestInProgress.current = false;
        }
    }, []);

    // Retry with exponential backoff
    const handleCameraRetry = useCallback(() => {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
        setRetryCount(prev => prev + 1);
        setCameraPermission('checking');
        setTimeout(() => requestCameraAccess(), delay);
    }, [retryCount, requestCameraAccess]);

    // ─── Check camera permission on mount (auto-detect for returning users) ───
    useEffect(() => {
        const checkInitial = async () => {
            try {
                if (!navigator.permissions) return;
                const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
                if (status.state === 'granted') {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const cameras = devices
                        .filter(d => d.kind === 'videoinput')
                        .map((d, i) => ({ id: d.deviceId, label: d.label || `Kamera ${i + 1}` }));
                    setAvailableCameras(cameras);
                    setCameraPermission(cameras.length > 0 ? 'granted' : 'no-camera');
                } else if (status.state === 'denied') {
                    setCameraPermission('denied');
                }
                // 'prompt' → stay at 'unknown', user must click button
            } catch {
                // Permissions API not supported on this browser, stay at 'unknown'
            }
        };
        checkInitial();
    }, []);

    // ─── Derived helpers (must be before hooks that use them) ───
    const isInsideGeofence = geoStatus?.inside ?? false;
    const hasCheckedIn = !!todayAttendance?.checkInTime;
    const hasCheckedOut = !!todayAttendance?.checkOutTime;
    const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

    // Scanner enabled logic:
    //  - No check-in yet → enabled (for checkin)
    //  - Checked in, checkout window open → enabled (for checkout)
    //  - Checked in, checkout window NOT open → DISABLED (locked)
    //  - Both done → disabled (complete)
    const isCheckoutLocked = hasCheckedIn && !hasCheckedOut && !checkoutWindow.canCheckout;
    const isScanEnabled = isInsideGeofence && !hasCheckedOut && !isCheckoutLocked;

    const formatTimeHHMM = (date: Date | null) => {
        if (!date) return '--:--';
        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    };

    const formatCountdown = (minutes: number): string => {
        if (minutes <= 0) return 'sekarang';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0) return `${h} jam ${m > 0 ? `${m} menit` : ''}`;
        return `${m} menit`;
    };

    // ─── Camera scanner lifecycle (Html5Qrcode direct control) ───
    const scannerDivId = 'guru-qr-reader';

    useEffect(() => {
        // Only start scanner when all conditions are met
        if (scanTab !== 'camera' || !isScanEnabled || cameraPermission !== 'granted') {
            // Clean up if conditions no longer met
            if (html5QrRef.current) {
                html5QrRef.current.stop().catch(() => { });
                html5QrRef.current = null;
            }
            return;
        }

        let cancelled = false;

        const startScanner = async () => {
            // Small delay to ensure DOM element is rendered
            await new Promise(r => setTimeout(r, 400));
            if (cancelled) return;

            const el = document.getElementById(scannerDivId);
            if (!el || cancelled) return;

            // Clean up previous instance if any
            if (html5QrRef.current) {
                try { await html5QrRef.current.stop(); } catch { /* ignore */ }
                html5QrRef.current = null;
            }

            const qr = new Html5Qrcode(scannerDivId);
            html5QrRef.current = qr;

            // Prefer back camera by label, fallback to facingMode constraint
            const backCamera = availableCameras.find(c =>
                /back|rear|belakang|environment/i.test(c.label)
            );

            try {
                await qr.start(
                    backCamera ? backCamera.id : { facingMode: 'environment' },
                    { fps: 5, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                    (decodedText) => {
                        qr.stop().catch(() => { });
                        html5QrRef.current = null;
                        handleScanResultRef.current(decodedText);
                    },
                    () => { } // ignore intermediate scan errors
                );
            } catch (err: any) {
                if (!cancelled) {
                    setCameraPermission('error');
                    setCameraError(err.message || 'Gagal memulai scanner kamera.');
                }
            }
        };

        startScanner();

        return () => {
            cancelled = true;
            if (html5QrRef.current) {
                html5QrRef.current.stop().catch(() => { });
                html5QrRef.current = null;
            }
        };
        // scannerTrigger forces restart (e.g., after closing result modal)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scanTab, isScanEnabled, cameraPermission, scannerTrigger, availableCameras]);

    // ─── Upload QR: canvas preprocessing + multi-strategy retry ───
    const decodeFromCanvas = async (canvas: HTMLCanvasElement): Promise<string | null> => {
        try {
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
            });
            const processedFile = new File([blob], 'qr-processed.png', { type: 'image/png' });

            const html5Qr = new Html5Qrcode('guru-qr-upload-canvas');
            const result = await html5Qr.scanFile(processedFile, true);
            await html5Qr.clear();
            return result;
        } catch {
            return null;
        }
    };

    const preprocessAndDecode = async (file: File): Promise<string | null> => {
        // Load image
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = URL.createObjectURL(file);
        });

        // Resize to optimal size (avoid memory issues on phones)
        const maxDim = 800;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        // Fix: willReadFrequently eliminates performance warning
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        let result: string | null = null;

        // Strategy 1: Grayscale + high contrast + brightness
        ctx.filter = 'grayscale(1) contrast(2) brightness(1.2)';
        ctx.drawImage(img, 0, 0, width, height);
        result = await decodeFromCanvas(canvas);
        if (result) { URL.revokeObjectURL(img.src); return result; }

        // Strategy 2: Rotate 90° (handle rotated photos)
        const rotCanvas = document.createElement('canvas');
        rotCanvas.width = height;
        rotCanvas.height = width;
        const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true })!;
        rotCtx.filter = 'grayscale(1) contrast(2) brightness(1.2)';
        rotCtx.translate(height / 2, width / 2);
        rotCtx.rotate(Math.PI / 2);
        rotCtx.drawImage(img, -width / 2, -height / 2, width, height);
        result = await decodeFromCanvas(rotCanvas);
        if (result) { URL.revokeObjectURL(img.src); return result; }

        // Strategy 3: Invert colors (dark QR on light bg → light on dark)
        ctx.filter = 'grayscale(1) contrast(2) invert(1)';
        ctx.drawImage(img, 0, 0, width, height);
        result = await decodeFromCanvas(canvas);

        URL.revokeObjectURL(img.src);
        return result;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setScanResult(null);
        setScanning(true);

        try {
            const qrData = await preprocessAndDecode(file);
            if (qrData) {
                handleScanResult(qrData);
            } else {
                setScanResult({
                    success: false,
                    message: 'QR tidak terbaca. Coba foto ulang dengan pencahayaan lebih baik, atau gunakan mode Kamera.',
                });
                setScanning(false);
            }
        } catch {
            setScanResult({
                success: false,
                message: 'Gagal memproses gambar. Pastikan file adalah gambar yang valid.',
            });
            setScanning(false);
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Selamat {new Date().getHours() < 12 ? 'Pagi' : new Date().getHours() < 17 ? 'Siang' : 'Sore'},{' '}
                    <span className="text-blue-600">{user?.name || 'Guru'}</span>
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · '}{currentTime} WIB
                </p>
            </div>

            {/* ─── Geofence Status Card ─── */}
            <div className={`rounded-2xl p-5 border-2 transition-all ${geoLoading
                ? 'bg-gray-50 border-gray-200'
                : isInsideGeofence
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {geoLoading ? (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                            </div>
                        ) : isInsideGeofence ? (
                            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-200">
                                <Wifi className="w-5 h-5 text-white" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-200">
                                <WifiOff className="w-5 h-5 text-white" />
                            </div>
                        )}
                        <div>
                            <p className={`font-semibold text-sm ${geoLoading ? 'text-gray-600' : isInsideGeofence ? 'text-green-800' : 'text-red-800'}`}>
                                {geoLoading ? 'Mengecek lokasi...' : isInsideGeofence ? 'Di dalam area sekolah' : 'Di luar area sekolah'}
                            </p>
                            {geoStatus && (
                                <p className={`text-xs mt-0.5 ${isInsideGeofence ? 'text-green-600' : 'text-red-600'}`}>
                                    <MapPin className="w-3 h-3 inline mr-1" />
                                    {geoStatus.distance}m dari {geoStatus.label} (radius {geoStatus.radiusMeters}m)
                                </p>
                            )}
                            {geoError && <p className="text-xs text-red-600 mt-0.5">{geoError}</p>}
                        </div>
                    </div>
                    <button
                        onClick={requestLocation}
                        disabled={geoLoading}
                        className="p-2 rounded-lg hover:bg-white/50 transition-colors text-gray-500 disabled:opacity-40"
                        title="Refresh lokasi"
                    >
                        <RefreshCw className={`w-4 h-4 ${geoLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ─── Status Cards ─── */}
            <div className="grid grid-cols-2 gap-4">
                {/* Check-in Status */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <LogIn className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Check-in</span>
                    </div>
                    {attendanceLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
                    ) : hasCheckedIn ? (
                        <>
                            <p className="text-lg font-bold text-green-600">{todayAttendance?.checkInTime?.slice(0, 5)}</p>
                            <p className="text-xs text-gray-400 mt-0.5 capitalize">{todayAttendance?.status}</p>
                        </>
                    ) : (
                        <>
                            <p className="text-lg font-bold text-gray-300">--:--</p>
                            <p className="text-xs text-gray-400 mt-0.5">Belum check-in</p>
                        </>
                    )}
                </div>

                {/* Check-out Status */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <LogOutIcon className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Check-out</span>
                    </div>
                    {attendanceLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
                    ) : hasCheckedOut ? (
                        <>
                            <p className="text-lg font-bold text-green-600">{todayAttendance?.checkOutTime?.slice(0, 5)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Selesai</p>
                        </>
                    ) : (
                        <>
                            <p className="text-lg font-bold text-gray-300">--:--</p>
                            <p className="text-xs text-gray-400 mt-0.5">{hasCheckedIn ? 'Menunggu check-out' : 'Belum check-in'}</p>
                        </>
                    )}
                </div>
            </div>

            {/* ─── Checkout Lock Alert ─── */}
            {isCheckoutLocked && checkoutWindow.toleranceStart && (
                <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Lock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-amber-800 text-sm">Checkout belum dibuka</p>
                        <p className="text-sm text-amber-700 mt-1">
                            Checkout buka dalam <span className="font-bold">{formatCountdown(checkoutWindow.minutesUntil)}</span>
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                                Window checkout: {formatTimeHHMM(checkoutWindow.toleranceStart)} – {formatTimeHHMM(checkoutWindow.checkoutEnd)} WIB
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── QR Scan Section ─── */}
            <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isCheckoutLocked ? 'border-gray-300 opacity-60' : 'border-gray-200'}`}>
                {/* Tab Header */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => !isCheckoutLocked && setScanTab('camera')}
                        disabled={isCheckoutLocked}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${isCheckoutLocked
                            ? 'text-gray-400 cursor-not-allowed'
                            : scanTab === 'camera'
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Camera className="w-4 h-4" />
                        Kamera
                    </button>
                    <button
                        onClick={() => !isCheckoutLocked && setScanTab('upload')}
                        disabled={isCheckoutLocked}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${isCheckoutLocked
                            ? 'text-gray-400 cursor-not-allowed'
                            : scanTab === 'upload'
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Upload className="w-4 h-4" />
                        Upload Foto
                    </button>
                </div>

                {/* Tab Content */}
                <div className="p-5">
                    {isCheckoutLocked ? (
                        /* Checkout locked — scanner disabled */
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                <Lock className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="font-semibold text-gray-600">Scanner dinonaktifkan</p>
                            <p className="text-sm text-gray-500 mt-1">
                                Anda sudah check-in. Checkout akan dibuka pada pukul{' '}
                                <span className="font-semibold text-amber-600">
                                    {formatTimeHHMM(checkoutWindow.toleranceStart)} WIB
                                </span>
                            </p>
                            {checkoutWindow.minutesUntil > 0 && (
                                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-700">
                                    <Clock className="w-3.5 h-3.5" />
                                    {formatCountdown(checkoutWindow.minutesUntil)} lagi
                                </div>
                            )}
                        </div>
                    ) : !isInsideGeofence && !geoLoading ? (
                        /* Outside geofence — disabled state */
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <WifiOff className="w-8 h-8 text-red-400" />
                            </div>
                            <p className="font-semibold text-gray-700">Scan tidak tersedia</p>
                            <p className="text-sm text-gray-500 mt-1">
                                Anda harus berada di dalam area sekolah untuk melakukan presensi.
                                {geoStatus && ` Jarak saat ini: ${geoStatus.distance}m (max ${geoStatus.radiusMeters}m).`}
                            </p>
                        </div>
                    ) : geoLoading ? (
                        <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-400 mb-3" />
                            <p className="text-sm text-gray-500">Menunggu lokasi GPS...</p>
                        </div>
                    ) : hasCheckedIn && hasCheckedOut ? (
                        /* Both done */
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                            <p className="font-semibold text-green-700">Presensi hari ini sudah lengkap!</p>
                            <p className="text-sm text-gray-500 mt-1">
                                Check-in {todayAttendance?.checkInTime?.slice(0, 5)} · Check-out {todayAttendance?.checkOutTime?.slice(0, 5)}
                            </p>
                        </div>
                    ) : scanTab === 'camera' ? (
                        /* Camera Scanner — permission state machine */
                        <div>
                            {/* Checkout ready hint */}
                            {hasCheckedIn && checkoutWindow.canCheckout && cameraPermission === 'granted' && (
                                <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    <p className="text-xs text-green-700 font-medium">Checkout ready — scan QR untuk check-out</p>
                                </div>
                            )}

                            {/* State: unknown — show "activate camera" button */}
                            {cameraPermission === 'unknown' && (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-4">
                                        <Camera className="w-8 h-8 text-blue-500" />
                                    </div>
                                    <p className="font-semibold text-gray-700">Kamera belum diaktifkan</p>
                                    <p className="text-sm text-gray-500 mt-1 mb-4">
                                        Izinkan akses kamera untuk scan QR Code presensi
                                    </p>
                                    <button
                                        onClick={requestCameraAccess}
                                        className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md shadow-blue-200"
                                    >
                                        Aktifkan Kamera
                                    </button>
                                </div>
                            )}

                            {/* State: checking — loading spinner */}
                            {cameraPermission === 'checking' && (
                                <div className="text-center py-8">
                                    <Loader2 className="w-10 h-10 mx-auto animate-spin text-blue-400 mb-3" />
                                    <p className="font-medium text-gray-600 text-sm">Meminta akses kamera...</p>
                                    <p className="text-xs text-gray-400 mt-1">Jika muncul popup izin, ketuk "Izinkan"</p>
                                </div>
                            )}

                            {/* State: denied — blocked guide + retry */}
                            {cameraPermission === 'denied' && (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
                                        <CameraOff className="w-8 h-8 text-red-400" />
                                    </div>
                                    <p className="font-semibold text-gray-700">Akses kamera diblokir</p>
                                    <p className="text-sm text-gray-500 mt-1 mb-3">
                                        Browser memblokir akses kamera. Ikuti langkah berikut:
                                    </p>
                                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left text-xs text-gray-600 space-y-2 mb-4 max-w-xs mx-auto">
                                        <div className="flex gap-2">
                                            <span className="font-bold text-gray-800 flex-shrink-0">1.</span>
                                            <span>Ketuk ikon <strong>gembok/info (i)</strong> di address bar browser</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="font-bold text-gray-800 flex-shrink-0">2.</span>
                                            <span>Cari <strong>"Kamera"</strong> atau <strong>"Camera"</strong></span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="font-bold text-gray-800 flex-shrink-0">3.</span>
                                            <span>Ubah dari <strong>"Block"</strong> ke <strong>"Allow"</strong></span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="font-bold text-gray-800 flex-shrink-0">4.</span>
                                            <span>Refresh halaman atau ketuk tombol di bawah</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCameraRetry}
                                        className="px-5 py-2 bg-gray-800 text-white rounded-xl font-medium text-sm hover:bg-gray-900 transition-colors inline-flex items-center gap-2"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        Coba Lagi
                                    </button>
                                    {retryCount > 2 && (
                                        <p className="text-xs text-gray-400 mt-2">
                                            Tidak berhasil? Gunakan tab <strong>Upload Foto</strong> sebagai alternatif.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* State: no-camera — device has no camera */}
                            {cameraPermission === 'no-camera' && (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                        <CameraOff className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="font-semibold text-gray-700">Kamera tidak tersedia</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {cameraError || 'Perangkat ini tidak memiliki kamera.'}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Gunakan tab <strong className="text-blue-600">Upload Foto</strong> untuk scan QR dari gambar.
                                    </p>
                                </div>
                            )}

                            {/* State: error — generic camera error + retry */}
                            {cameraPermission === 'error' && (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
                                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                                    </div>
                                    <p className="font-semibold text-gray-700">Gagal mengakses kamera</p>
                                    <p className="text-sm text-gray-500 mt-1 mb-4">
                                        {cameraError || 'Terjadi kesalahan saat membuka kamera.'}
                                    </p>
                                    <button
                                        onClick={handleCameraRetry}
                                        className="px-5 py-2 bg-amber-600 text-white rounded-xl font-medium text-sm hover:bg-amber-700 transition-colors inline-flex items-center gap-2"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        Coba Lagi
                                    </button>
                                    {retryCount > 1 && (
                                        <p className="text-xs text-gray-400 mt-2">
                                            Tip: Tutup aplikasi lain yang menggunakan kamera, lalu coba lagi.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* State: granted — QR scanner renders here */}
                            {cameraPermission === 'granted' && (
                                <div id={scannerDivId} className="w-full max-w-sm mx-auto rounded-lg overflow-hidden" />
                            )}
                        </div>
                    ) : (
                        /* Upload mode */
                        <div className="text-center">
                            {hasCheckedIn && checkoutWindow.canCheckout && (
                                <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    <p className="text-xs text-green-700 font-medium">Checkout ready — upload foto QR untuk check-out</p>
                                </div>
                            )}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                            >
                                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-sm font-medium text-gray-600">Klik untuk upload foto QR</p>
                                <p className="text-xs text-gray-400 mt-1">PNG, JPG — pastikan QR terlihat jelas</p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            {/* Hidden canvas for html5-qrcode file decode */}
                            <div id="guru-qr-upload-canvas" className="hidden" />
                        </div>
                    )}

                    {/* Scanning indicator */}
                    {scanning && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Memproses scan...
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Scan Result Modal ─── */}
            {scanResult && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-in fade-in zoom-in-95">
                        {scanResult.success ? (
                            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                        ) : (
                            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <XCircle className="w-8 h-8 text-red-500" />
                            </div>
                        )}
                        <h3 className={`text-lg font-semibold ${scanResult.success ? 'text-green-800' : 'text-red-800'}`}>
                            {scanResult.success ? 'Berhasil!' : 'Gagal'}
                        </h3>
                        <p className="text-sm text-gray-600 mt-2">{scanResult.message}</p>
                        <button
                            onClick={() => {
                                setScanResult(null);
                                // Refresh attendance after scan to update checkout window
                                fetchAttendanceToday();
                                // Trigger scanner restart if on camera tab
                                if (scanTab === 'camera' && isScanEnabled && cameraPermission === 'granted') {
                                    setScannerTrigger(t => t + 1);
                                }
                            }}
                            className="mt-5 w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-600 hover:to-indigo-700 transition-all"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Info ─── */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <ScanLine className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                    <p className="font-medium">Cara presensi</p>
                    <p className="mt-0.5 text-blue-600">
                        Scan QR di ruang guru menggunakan kamera atau upload foto.
                        Sistem akan otomatis menentukan check-in atau check-out.
                        Pastikan Anda berada di area sekolah.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GuruDashboard;
