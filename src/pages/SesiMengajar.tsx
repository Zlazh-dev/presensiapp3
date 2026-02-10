import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import Scanner from '../components/Scanner';
import { useSocket } from '../context/SocketContext';
import ConfirmModal from '../components/ConfirmModal';
import {
    Loader2, CheckCircle, Users, Clock,
    LogOut as LogOutIcon,
    Calendar, Timer, Camera as CameraIcon,
    AlertTriangle
} from 'lucide-react';

// Types from Backend
interface CurrentSession {
    id: number; // ScheduleID or SessionID
    scheduleId: number;
    classId: number;
    className: string;
    subjectName: string;
    startTime: string; // Actual check-in time
    endTime: string; // Planned end time
    // NEW: Schedule times for accurate timer calculation
    scheduleStartTime?: string;
    scheduleEndTime?: string;
    durationMinutes?: number;
    status: 'scheduled' | 'ongoing' | 'active' | 'completed';
    hasCheckIn: boolean;
    canCheckIn: boolean;
    canCheckOut: boolean;
    minutesUntilCheckIn: number;
    minutesUntilCheckOut: number;
    isSubstitute: boolean;
    nextSessionId: number | null;
}

interface Student {
    id: number;
    nis: string;
    name: string;
    gender: 'M' | 'F';
}

type AttendanceStatus = 'present' | 'sick' | 'permission' | 'alpha';

// Session Status Enum for real-time tracking
// NOT_STARTED: checked in but schedule hasn't started yet
// ONGOING: session is running (0-89% elapsed)
// ENDING_SOON: session almost done (90-99% elapsed)
// ENDED: session time is up (100%+ elapsed)
type SessionStatusType = 'NOT_STARTED' | 'ONGOING' | 'ENDING_SOON' | 'ENDED';

const STATUS_OPTIONS = [
    { value: 'present', label: 'Hadir', color: 'text-green-700', bg: 'bg-green-100 border-green-200' },
    { value: 'late', label: 'Terlambat', color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-200' },
    { value: 'sick', label: 'Sakit', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200' },
    { value: 'permission', label: 'Izin', color: 'text-purple-700', bg: 'bg-purple-100 border-purple-200' },
    { value: 'alpha', label: 'Alpha', color: 'text-red-700', bg: 'bg-red-100 border-red-200' },
];

// Helper to parse time string (HH:MM:SS or HH:MM) to Date for today
const parseTimeToDate = (timeStr: string): Date => {
    if (!timeStr) {
        console.warn('[parseTimeToDate] Empty time string received, using current time');
        return new Date();
    }

    const now = new Date();
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;

    // Validate parsed values
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        console.error('[parseTimeToDate] Invalid time format:', timeStr);
        return now;
    }

    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
    return date;
};

// Helper to format seconds to HH:MM:SS or MM:SS
const formatTime = (totalSeconds: number): string => {
    if (totalSeconds < 0 || isNaN(totalSeconds)) return '00:00';

    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};



const SesiMengajar: React.FC = () => {
    const { socket, joinSession, leaveSession } = useSocket();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [currentSession, setCurrentSession] = useState<CurrentSession | null>(null);
    const [noSessionMessage, setNoSessionMessage] = useState<string | null>(null);

    // UI State
    const [viewMode, setViewMode] = useState<'LOADING' | 'DASHBOARD' | 'SCANNER' | 'ATTENDANCE_FORM' | 'SUMMARY'>('LOADING');
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [geoError, setGeoError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Data for Attendance Form
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdSessionId, setCreatedSessionId] = useState<number | null>(null); // To store session ID after check-in

    // Initial Fetch
    useEffect(() => {
        fetchSessionData();
    }, []);

    // Global listener for schedule updates (even if no session active)
    useEffect(() => {
        if (!socket) return;
        const handleScheduleUpdate = () => {
            console.log('Global schedule update received');
            fetchSessionData();
        };
        socket.on('schedule:updated', handleScheduleUpdate);
        return () => {
            socket.off('schedule:updated', handleScheduleUpdate);
        };
    }, [socket]);

    // Socket Listener for Real-Time Updates
    useEffect(() => {
        if (!currentSession?.id || !socket) return;

        console.log('Joining session room:', currentSession.id);
        joinSession(currentSession.id);

        const handleStatusChange = (data: any) => {
            console.log('Session Status Changed:', data);
            fetchSessionData();
        };

        const handleTimeUpdate = (data: any) => {
            // Optional: Log only occasionally to avoid console spam
            // console.log('Time Update:', data);
            setCurrentSession(prev => {
                if (!prev) return null;
                // Only update time-related fields to avoid unnecessary re-renders of other parts
                return {
                    ...prev,
                    minutesUntilCheckIn: data.minutesUntilCheckIn,
                    minutesUntilCheckOut: data.minutesUntilCheckOut,
                    canCheckIn: data.canCheckIn,
                    canCheckOut: data.canCheckOut
                };
            });
        };

        const handleRecalculate = (data: any) => {
            // If we wanted to be specific: if (user.teacherId === data.teacherId) ... but simple re-fetch is safe
            console.log('Schedule updated, refreshing session...');
            fetchSessionData();
        };

        socket.on('session:status-changed', handleStatusChange);
        socket.on('session:time-update', handleTimeUpdate);
        socket.on('schedule:updated', handleRecalculate); // Listen for schedule changes

        return () => {
            console.log('Leaving session room:', currentSession.id);
            leaveSession(currentSession.id);
            socket.off('session:status-changed', handleStatusChange);
            socket.off('session:time-update', handleTimeUpdate);
            socket.off('schedule:updated', handleRecalculate);
        };
    }, [currentSession?.id, socket, joinSession, leaveSession]);

    const fetchSessionData = async () => {
        try {
            const res = await api.get('/sessions/my-current');
            if (res.data.currentSession) {
                setCurrentSession(res.data.currentSession);
                setNoSessionMessage(null);
            } else {
                setCurrentSession(null);
                setNoSessionMessage(res.data.message || 'Tidak ada jadwal sesi saat ini.');
            }
        } catch (err) {
            console.error('Failed to fetch session:', err);
            setError('Gagal memuat data sesi.');
        } finally {
            setIsLoading(false);
            if (viewMode === 'LOADING') setViewMode('DASHBOARD');
        }
    };

    // Geolocation Helper
    const getLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setGeoError(null);
                },
                (err) => {
                    console.error(err);
                    setGeoError('Gagal mendapatkan lokasi. Pastikan GPS aktif.');
                }
            );
        } else {
            setGeoError('Browser tidak mendukung geolokasi.');
        }
    };

    // Handlers
    const handleStartScan = () => {
        getLocation();
        setViewMode('SCANNER');
        setError(null);
    };

    const handleScan = async (decodedText: string) => {
        if (!currentSession) return;
        if (!location) {
            setError('Menunggu lokasi GPS... Coba lagi sesaat.');
            getLocation();
            return;
        }

        setViewMode('LOADING'); // Show loading while processing check-in

        try {
            const res = await api.post('/sessions/check-in', {
                qrData: decodedText,
                lat: location.lat,
                lng: location.lng
            });

            const { session: newSession, students: studentList } = res.data;

            // Store IDs
            setCreatedSessionId(newSession.id);
            setStudents(studentList);

            // Init attendance
            const initialAtt: Record<number, AttendanceStatus> = {};
            studentList.forEach((s: Student) => { initialAtt[s.id] = 'present'; });
            setAttendance(initialAtt);

            setViewMode('ATTENDANCE_FORM');
            // Refresh main status in background
            fetchSessionData();

        } catch (err: any) {
            // Handle session conflict (HTTP 409) - teacher has active session elsewhere
            if (err.response?.status === 409 && err.response?.data?.code === 'SESSION_CONFLICT') {
                const activeSession = err.response.data.activeSession;
                setError(
                    `Anda sudah memiliki sesi aktif di ${activeSession.className} - ${activeSession.subjectName}. ` +
                    `Selesaikan sesi tersebut sebelum memulai sesi baru.`
                );
            } else {
                setError(err.response?.data?.error || 'QR Code tidak valid atau terjadi kesalahan.');
            }
            setViewMode('SCANNER');
        }
    };

    const handleAttendanceSubmit = async () => {
        if (!createdSessionId) return;
        setIsSubmitting(true);
        try {
            const statuses = Object.entries(attendance).map(([studentId, status]) => ({
                studentId: Number(studentId),
                status
            }));

            await api.post(`/sessions/${createdSessionId}/student-attendance`, { statuses });
            alert('Absensi berhasil disimpan!');
            setViewMode('DASHBOARD');
            fetchSessionData();
        } catch (err: any) {
            alert('Gagal menyimpan absensi: ' + (err.response?.data?.error || 'Unknown error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // State for early checkout modal
    const [showEarlyCheckoutModal, setShowEarlyCheckoutModal] = useState(false);
    const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('');
    const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
    const [earlyCheckoutInfo, setEarlyCheckoutInfo] = useState<{
        elapsedPercent: number;
        elapsedMinutes: number;
        totalMinutes: number;
        minutesUntilNormalCheckout: number;
        availableReasons: { value: string; label: string }[];
    } | null>(null);

    const handleCheckout = async (reason?: string) => {
        if (!currentSession) return;

        // If not confirming with reason, show custom modal
        if (!reason) {
            setShowCheckoutConfirm(true);
            return;
        }

        setIsSubmitting(true);
        try {
            const activeRes = await api.get('/sessions/my-active');
            const realSessionId = activeRes.data?.id;

            if (!realSessionId) {
                alert("Sesi aktif tidak ditemukan.");
                return;
            }

            const payload: { earlyCheckoutReason?: string } = {};
            if (reason) {
                payload.earlyCheckoutReason = reason;
            }

            await api.post(`/sessions/${realSessionId}/check-out`, payload);
            setShowEarlyCheckoutModal(false);
            setEarlyCheckoutReason('');
            setEarlyCheckoutInfo(null);
            setViewMode('SUMMARY');
            fetchSessionData();
        } catch (err: any) {
            const errorData = err.response?.data;

            // Handle early checkout requiring reason
            if (errorData?.earlyCheckout && errorData?.requiresReason) {
                setEarlyCheckoutInfo({
                    elapsedPercent: errorData.elapsedPercent,
                    elapsedMinutes: errorData.elapsedMinutes,
                    totalMinutes: errorData.totalMinutes,
                    minutesUntilNormalCheckout: errorData.minutesUntilNormalCheckout,
                    availableReasons: errorData.availableReasons || []
                });
                setShowEarlyCheckoutModal(true);
                return;
            }

            alert('Gagal check-out: ' + (errorData?.error || 'Unknown error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEarlyCheckoutConfirm = () => {
        if (!earlyCheckoutReason) {
            alert('Silakan pilih alasan checkout awal');
            return;
        }
        handleCheckout(earlyCheckoutReason);
    };

    // Early Checkout Modal Component
    const EarlyCheckoutModal = () => {
        if (!showEarlyCheckoutModal || !earlyCheckoutInfo) return null;

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                    <div className="text-center">
                        <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                            <AlertTriangle className="w-8 h-8 text-yellow-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Checkout Awal</h3>
                        <p className="text-gray-600 text-sm mt-2">
                            Sesi baru berjalan <span className="font-bold text-yellow-600">{earlyCheckoutInfo.elapsedPercent}%</span>
                            ({earlyCheckoutInfo.elapsedMinutes} dari {earlyCheckoutInfo.totalMinutes} menit).
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                            Checkout normal tersedia dalam {earlyCheckoutInfo.minutesUntilNormalCheckout} menit.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Alasan Checkout Awal <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={earlyCheckoutReason}
                            onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        >
                            <option value="">-- Pilih Alasan --</option>
                            {earlyCheckoutInfo.availableReasons.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                        <strong>Catatan:</strong> Checkout awal akan dicatat dalam sistem untuk keperluan audit.
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setShowEarlyCheckoutModal(false);
                                setEarlyCheckoutReason('');
                                setEarlyCheckoutInfo(null);
                            }}
                            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleEarlyCheckoutConfirm}
                            disabled={!earlyCheckoutReason || isSubmitting}
                            className="flex-1 py-3 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Konfirmasi
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // -- Sub Components --

    const EmptyState = () => (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl shadow-sm border h-80">
            <Calendar className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">Tidak Ada Jadwal</h3>
            <p className="text-gray-500 mt-2">{noSessionMessage}</p>
        </div>
    );

    const CountdownCard = ({ label, minutes, color = "blue" }: { label: string, minutes: number, color?: string }) => (
        <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-6 text-center`}>
            <Timer className={`w-10 h-10 text-${color}-600 mx-auto mb-3 animate-pulse`} />
            <h3 className={`text-lg font-bold text-${color}-800`}>{label}</h3>
            <p className={`text-3xl font-mono font-bold text-${color}-600 my-2`}>
                {minutes} <span className="text-sm font-sans font-normal text-gray-500">menit lagi</span>
            </p>
            <p className="text-sm text-gray-500">Mohon tunggu hingga waktu yang ditentukan.</p>
        </div>
    );

    const ActiveSessionCard = () => {
        if (!currentSession) return null;
        return (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg text-white p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-green-100 border border-green-500/30 text-xs font-mono mb-3">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                {currentSession.status === 'active' || currentSession.hasCheckIn ? 'SESI AKTIF' : 'JADWAL BERIKUTNYA'}
                            </div>
                            <h2 className="text-3xl font-bold mb-1">{currentSession.className}</h2>
                            <p className="text-blue-100 text-lg">{currentSession.subjectName}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-mono font-bold">{currentSession.startTime}</p>
                            <p className="text-xs text-blue-200 uppercase tracking-wider">Mulai</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Real-Time Session Status Card with Timer
    const SessionStatusCard = ({ session, onCheckout, isSubmitting }: {
        session: CurrentSession;
        onCheckout: () => void;
        isSubmitting: boolean;
    }) => {
        const [currentTime, setCurrentTime] = useState(new Date());
        const [sessionStatus, setSessionStatus] = useState<SessionStatusType>('ONGOING');
        const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


        // USE SCHEDULE TIMES for duration calculation (not actual check-in time!)
        // Fallback to startTime/endTime if schedule times not available
        const schedStart = session.scheduleStartTime || session.startTime;
        const schedEnd = session.scheduleEndTime || session.endTime;
        const scheduleStartTime = parseTimeToDate(schedStart);
        const scheduleEndTime = parseTimeToDate(schedEnd);

        // Update current time every second
        useEffect(() => {
            // Debug on mount
            console.log('=== SessionStatusCard Mount ===');
            console.log('Check-in Time:', session.startTime);
            console.log('Schedule Start:', schedStart);
            console.log('Schedule End:', schedEnd);
            console.log('Duration (min):', session.durationMinutes);
            console.log('Schedule Start Parsed:', scheduleStartTime.toLocaleTimeString());
            console.log('Schedule End Parsed:', scheduleEndTime.toLocaleTimeString());
            console.log('==============================');

            const updateTime = () => {
                const now = new Date();
                setCurrentTime(now);

                // Use SCHEDULE times for calculations (not check-in time!)
                const totalDurationMs = scheduleEndTime.getTime() - scheduleStartTime.getTime();
                const elapsedMs = now.getTime() - scheduleStartTime.getTime();
                const remainingMs = scheduleEndTime.getTime() - now.getTime();

                // Validate that we have valid duration (end > start)
                if (totalDurationMs <= 0) {
                    console.error('[SessionStatusCard] Invalid session times: endTime <= startTime', {
                        schedStart,
                        schedEnd,
                        totalDurationMs
                    });
                    setSessionStatus('ONGOING'); // Default to ongoing if invalid
                    return;
                }

                // Calculate percentage correctly
                const elapsedPercent = Math.round((elapsedMs / totalDurationMs) * 100);

                // Log every 10 seconds for debugging
                const currentSecs = now.getSeconds();
                if (currentSecs % 10 === 0) {
                    console.log(`[Timer] ${elapsedPercent}% elapsed, ${Math.round(remainingMs / 60000)}m remaining`);
                }

                // Determine status based on elapsed time and schedule
                // NOT_STARTED: currentTime < scheduleStartTime (elapsedMs < 0)
                // ENDED: elapsed >= 100% (past end time)
                // ENDING_SOON: elapsed >= 90% (last 10% of session)
                // ONGOING: session is running normally (0-89%)
                if (elapsedMs < 0) {
                    // Session hasn't started yet (early check-in)
                    setSessionStatus('NOT_STARTED');
                } else if (remainingMs <= 0 || elapsedPercent >= 100) {
                    setSessionStatus('ENDED');
                } else if (elapsedPercent >= 90) {
                    setSessionStatus('ENDING_SOON');
                } else {
                    setSessionStatus('ONGOING');
                }
            };

            // Initial call
            updateTime();

            // Set interval
            intervalRef.current = setInterval(updateTime, 1000);

            // Cleanup
            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        }, [schedStart, schedEnd]);

        // Calculate values for display using SCHEDULE times
        const totalDurationMs = scheduleEndTime.getTime() - scheduleStartTime.getTime();
        const elapsedMs = currentTime.getTime() - scheduleStartTime.getTime();
        const remainingMs = scheduleEndTime.getTime() - currentTime.getTime();
        const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

        // Calculate elapsed percentage (cap at 0% minimum, 100% maximum)
        // elapsedMs can be negative if check-in before schedule start
        const elapsedPercent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));
        const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000)); // Cap at 0 minimum
        const totalMinutes = Math.floor(totalDurationMs / 60000);

        // Session hasn't started yet?
        const sessionNotStarted = elapsedMs < 0;

        // STRICT RULE: 80% minimum for normal checkout
        const MIN_CHECKOUT_PERCENT = 80;
        const canNormalCheckout = !sessionNotStarted && elapsedPercent >= MIN_CHECKOUT_PERCENT;
        const canEarlyCheckout = !sessionNotStarted && elapsedPercent >= 50 && elapsedPercent < MIN_CHECKOUT_PERCENT;
        const checkoutBlocked = sessionNotStarted || elapsedPercent < 50;

        const minutesUntil80 = Math.max(0, Math.ceil((totalDurationMs * 0.8 - Math.max(0, elapsedMs)) / 60000));

        // Calculate time until session starts (for NOT_STARTED status)
        const minutesUntilStart = elapsedMs < 0 ? Math.ceil(Math.abs(elapsedMs) / 60000) : 0;

        // Status config
        const statusConfig = {
            NOT_STARTED: {
                icon: <Clock className="w-5 h-5" />,
                label: 'Belum Dimulai',
                message: `Sesi akan dimulai dalam ${minutesUntilStart} menit (${schedStart}). Anda sudah check-in.`,
                bgColor: 'bg-blue-50 border-blue-200',
                textColor: 'text-blue-700',
                badgeColor: 'bg-blue-100 text-blue-800'
            },
            ONGOING: {
                icon: <Clock className="w-5 h-5" />,
                label: 'Sesi Berlangsung',
                message: canNormalCheckout
                    ? `Sesi ${elapsedPercent}% selesai. Checkout tersedia.`
                    : `Sesi ${elapsedPercent}% selesai. Checkout dalam ${minutesUntil80} menit (80%).`,
                bgColor: 'bg-green-50 border-green-200',
                textColor: 'text-green-700',
                badgeColor: 'bg-green-100 text-green-800'
            },
            ENDING_SOON: {
                icon: <AlertTriangle className="w-5 h-5" />,
                label: 'Hampir Selesai',
                message: `Sesi ${elapsedPercent}% selesai (${formatTime(remainingSeconds)} tersisa). Silakan check-out.`,
                bgColor: 'bg-yellow-50 border-yellow-300',
                textColor: 'text-yellow-700',
                badgeColor: 'bg-yellow-100 text-yellow-800'
            },
            ENDED: {
                icon: <AlertTriangle className="w-5 h-5" />,
                label: 'Waktu Habis',
                message: `Sesi telah berakhir pada ${schedEnd}. Harap segera check-out.`,
                bgColor: 'bg-red-50 border-red-300',
                textColor: 'text-red-700',
                badgeColor: 'bg-red-100 text-red-800'
            }
        };

        const config = statusConfig[sessionStatus];

        return (
            <div className={`p-6 rounded-xl border-2 shadow-sm transition-all duration-300 ${config.bgColor}`}>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${config.badgeColor}`}>
                            {config.icon}
                        </div>
                        <div>
                            <h3 className={`font-bold ${config.textColor}`}>{config.label}</h3>
                            <p className="text-gray-600 text-sm">{config.message}</p>
                        </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg font-mono text-lg font-bold ${config.badgeColor}`}>
                        {elapsedPercent}%
                    </div>
                </div>

                {/* Live Clock Display */}
                <div className="flex justify-center mb-4">
                    <div className="bg-gray-800 text-white px-6 py-3 rounded-lg font-mono text-2xl shadow-inner">
                        {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                </div>

                {/* Progress Bar with 80% marker */}
                <div className="mb-4">
                    <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
                        {/* Progress fill */}
                        <div
                            className={`h-full transition-all duration-1000 rounded-full ${sessionStatus === 'ENDED' ? 'bg-red-500' :
                                sessionStatus === 'ENDING_SOON' ? 'bg-yellow-500' :
                                    elapsedPercent >= 80 ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                            style={{ width: `${elapsedPercent}%` }}
                        />
                        {/* 80% threshold marker */}
                        <div
                            className="absolute top-0 h-full w-0.5 bg-gray-600"
                            style={{ left: '80%' }}
                        />
                        <div
                            className="absolute -top-5 text-xs text-gray-600 font-medium"
                            style={{ left: '80%', transform: 'translateX(-50%)' }}
                        >
                            80%
                        </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>{session.startTime}</span>
                        <span className="font-medium">{elapsedMinutes}/{totalMinutes} menit</span>
                        <span>{session.endTime}</span>
                    </div>
                </div>

                {/* Checkout Button with strict rules */}
                <button
                    onClick={() => onCheckout()}
                    disabled={isSubmitting || checkoutBlocked}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${sessionNotStarted
                        ? 'bg-blue-100 text-blue-400 cursor-not-allowed border-2 border-dashed border-blue-300'
                        : checkoutBlocked
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-dashed border-gray-300'
                            : canEarlyCheckout
                                ? 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-lg'
                                : sessionStatus === 'ENDED'
                                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg animate-pulse'
                                    : 'bg-red-600 text-white hover:bg-red-700 shadow-lg'
                        }`}
                >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOutIcon className="w-5 h-5" />}
                    {sessionNotStarted
                        ? `Sesi dimulai dalam ${minutesUntilStart}m`
                        : checkoutBlocked
                            ? `Checkout di ${MIN_CHECKOUT_PERCENT}% (${minutesUntil80}m)`
                            : canEarlyCheckout
                                ? 'Checkout Awal (Perlu Alasan)'
                                : 'Check-out Sesi'
                    }
                </button>

                {/* Status-specific warning messages */}
                {canEarlyCheckout && (
                    <p className="text-xs text-yellow-600 text-center mt-2">
                        ⚠️ Checkout sebelum {MIN_CHECKOUT_PERCENT}% memerlukan alasan dan akan dicatat.
                    </p>
                )}
                {sessionNotStarted && (
                    <p className="text-xs text-blue-600 text-center mt-2">
                        ℹ️ Anda sudah check-in. Sesi akan dimulai pada {schedStart}.
                    </p>
                )}
            </div>
        );
    };

    // -- Main Render --

    if (isLoading || viewMode === 'LOADING') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <p className="text-gray-500">Memuat data...</p>
            </div>
        );
    }

    // View: SUMMARY (Just finished checkout)
    if (viewMode === 'SUMMARY') {
        return (
            <div className="max-w-md mx-auto py-12 text-center px-4">
                <div className="bg-white rounded-xl shadow-sm border p-8">
                    <div className="bg-green-100 p-4 rounded-full inline-flex mb-4">
                        <CheckCircle className="w-12 h-12 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Sesi Selesai</h2>
                    <p className="text-gray-600 mb-6">Terima kasih, sesi mengajar telah diakhiri.</p>
                    <button
                        onClick={() => { setViewMode('DASHBOARD'); fetchSessionData(); }}
                        className="w-full py-3 bg-primary text-white rounded-lg font-medium"
                    >
                        Kembali ke Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // View: ATTENDANCE FORM (Right after scan)
    if (viewMode === 'ATTENDANCE_FORM') {
        return (
            <div className="max-w-2xl mx-auto space-y-6 pb-20">
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-6 border-b bg-primary text-primary-foreground">
                        <h2 className="font-bold text-lg">Absensi Siswa</h2>
                        <p className="opacity-90 text-sm">Silakan isi kehadiran siswa untuk memulai sesi.</p>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto divide-y">
                        {students.map((student) => (
                            <div key={student.id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50">
                                <span className="font-medium">{student.name}</span>
                                <div className="flex gap-1">
                                    {STATUS_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setAttendance(prev => ({ ...prev, [student.id]: opt.value as AttendanceStatus }))}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${attendance[student.id] === opt.value ? `${opt.bg} ${opt.color} ring-2 ring-offset-1` : 'bg-gray-100 text-gray-400'}`}
                                        >
                                            {opt.label[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t bg-gray-50">
                        <button onClick={handleAttendanceSubmit} disabled={isSubmitting} className="w-full py-3 bg-primary text-white rounded-lg font-bold flex justify-center items-center gap-2">
                            {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />} Simpan & Mulai
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // View: SCANNER
    if (viewMode === 'SCANNER') {
        return (
            <div className="max-w-md mx-auto py-8 px-4 space-y-4">
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center">
                        <h2 className="font-semibold">Scan QR Kelas</h2>
                        <button onClick={() => setViewMode('DASHBOARD')} className="text-sm text-gray-500">Batal</button>
                    </div>
                    <div className="p-6">
                        {error && <div className="mb-4 text-red-600 bg-red-50 p-3 rounded text-sm">{error}</div>}
                        <Scanner onScanSuccess={handleScan} />
                    </div>
                </div>
            </div>
        );
    }

    // View: DASHBOARD (Default)
    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            <header>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Clock className="w-7 h-7 text-primary" />
                    Sesi Mengajar
                </h1>
                <p className="text-gray-500">Monitor jadwal dan status mengajar Anda</p>
            </header>

            {!currentSession ? (
                <EmptyState />
            ) : (
                <>
                    <ActiveSessionCard />

                    {/* Logic Flow based on State */}

                    {/* Case 1: Waiting to Start */}
                    {currentSession.minutesUntilCheckIn > 0 && !currentSession.hasCheckIn && (
                        <CountdownCard
                            label="Menuju Waktu Check-in"
                            minutes={currentSession.minutesUntilCheckIn}
                            color="blue"
                        />
                    )}

                    {/* Case 2: Ready to Check-in */}
                    {currentSession.canCheckIn && !currentSession.hasCheckIn && (
                        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                            <h3 className="font-bold text-gray-900 border-b pb-2">Siap untuk Memulai?</h3>
                            <p className="text-gray-600">
                                Waktu check-in telah dibuka (10 menit sebelum kelas mulai).
                                Pastikan Anda berada di dalam kelas.
                            </p>
                            <button
                                onClick={handleStartScan}
                                className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary/90 flex items-center justify-center gap-3 active:scale-95 transition-transform"
                            >
                                <CameraIcon className="w-6 h-6" />
                                Scan QR Code Kelas
                            </button>
                            {geoError && <p className="text-xs text-red-500 text-center">{geoError}</p>}
                        </div>
                    )}

                    {/* Case 3: Checked In (Active) */}
                    {currentSession.hasCheckIn && (
                        <div className="space-y-4">
                            {/* Real-Time Session Status Card */}
                            <SessionStatusCard
                                session={currentSession}
                                onCheckout={handleCheckout}
                                isSubmitting={isSubmitting}
                            />

                            {/* Additional Tools */}
                            <div className="grid grid-cols-1 gap-4">
                                <button
                                    onClick={() => setViewMode('ATTENDANCE_FORM')}
                                    className="bg-white p-4 rounded-lg border text-center cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                                >
                                    <Users className="w-8 h-8 mx-auto text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-base font-medium text-gray-700 group-hover:text-blue-700">Absensi Siswa</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {!currentSession.canCheckIn && !currentSession.hasCheckIn && currentSession.minutesUntilCheckIn <= 0 && (
                        currentSession.status === 'completed' && (
                            <div className="bg-gray-100 p-6 rounded-xl text-center">
                                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                <p className="font-medium text-gray-600">Sesi ini telah selesai.</p>
                            </div>
                        )
                    )}
                </>
            )}

            {/* Checkout Confirmation Modal */}
            <ConfirmModal
                open={showCheckoutConfirm}
                title="Akhiri Sesi?"
                message="Apakah Anda yakin ingin mengakhiri sesi mengajar ini?"
                confirmLabel="Ya, Akhiri"
                variant="warning"
                loading={isSubmitting}
                onConfirm={() => { setShowCheckoutConfirm(false); handleCheckout('normal'); }}
                onCancel={() => setShowCheckoutConfirm(false)}
            />

            {/* Early Checkout Confirmation Modal */}
            <EarlyCheckoutModal />
        </div>
    );
};

export default SesiMengajar;
