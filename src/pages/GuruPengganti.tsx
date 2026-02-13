import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { io, Socket } from 'socket.io-client';
import {
    UserCheck, AlertTriangle, GripVertical,
    RefreshCw, Calendar, Users, CheckCircle2,
    ArrowRightLeft, Timer,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────
type SessionStatus = 'upcoming' | 'ongoing' | 'completed';

interface SessionItem {
    id: number;
    scheduleId: number;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    substituteTeacherId: number | null;
    substituteTeacher: { id: number; name: string } | null;
    substituteCheckedIn?: boolean;
    countdownMins: number;
    countdownMs: number; // For 1-second countdown
    startTimeMs: number;
    endTimeMs: number;
    serverTimeMs: number;
    sessionStatus: SessionStatus;
    warning: boolean;
    class: { id: number; name: string } | null;
    subject: { id: number; name: string; code: string } | null;
    teacher: { id: number; name: string } | null;
}

interface TeacherItem {
    id: number;
    userId: number;
    name: string;
    employeeId: string;
    isCheckedIn: boolean;
    hasCheckedOut: boolean;
    isBusy: boolean;
}

const DND_TYPE = 'TEACHER';

// ─── API Helpers ─────────────────────────────────────────
const apiFetch = async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...options?.headers,
        },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

// ─── Draggable Teacher Card ──────────────────────────────
const DraggableTeacher: React.FC<{ teacher: TeacherItem }> = ({ teacher }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: DND_TYPE,
        item: { teacherId: teacher.id, teacherName: teacher.name },
        canDrag: () => !teacher.isBusy && !teacher.hasCheckedOut, // Prevent dragging busy or checked-out teachers
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }), [teacher]);

    const isUnavailable = teacher.isBusy || teacher.hasCheckedOut;

    return (
        <div
            ref={drag as any}
            className={`
                flex items-center gap-3 px-4 py-3 rounded-xl border
                transition-all duration-200 select-none
                ${isUnavailable
                    ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                    : 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-md cursor-grab'
                }
                ${isDragging ? 'opacity-30 scale-95 ring-2 ring-emerald-400' : ''}
            `}
        >
            <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${teacher.isCheckedIn
                ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                : 'bg-gradient-to-br from-gray-300 to-gray-400'
                }`}>
                {teacher.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 text-sm truncate">{teacher.name}</p>
                <p className="text-xs text-gray-500">{teacher.employeeId}</p>
            </div>
            {teacher.isBusy ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    Mengajar
                </span>
            ) : teacher.hasCheckedOut ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                    Sudah Pulang
                </span>
            ) : teacher.isCheckedIn ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Hadir
                </span>
            ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    Belum Hadir
                </span>
            )}
        </div>
    );
};

// ─── Droppable Session Card ──────────────────────────────
const DroppableSession: React.FC<{
    session: SessionItem;
    onDrop: (sessionId: number, teacherId: number) => void;
    now: Date;
}> = ({ session, onDrop, now }) => {
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: DND_TYPE,
        drop: (item: { teacherId: number }) => onDrop(session.id, item.teacherId),
        canDrop: () => !session.substituteTeacherId,
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [session, onDrop]);

    // Calculate real-time countdown from client time
    const nowMs = now.getTime();

    // Recompute status client-side for real-time accuracy (server snapshot may be stale)
    let sessionStatus: SessionStatus = 'upcoming';
    if (session.status === 'completed') {
        sessionStatus = 'completed';
    } else if (nowMs >= session.startTimeMs && nowMs <= session.endTimeMs) {
        sessionStatus = 'ongoing';
    } else if (nowMs > session.endTimeMs) {
        sessionStatus = 'completed';
    }

    const warning = sessionStatus === 'ongoing' && !session.substituteTeacherId && !session.substituteCheckedIn;
    const isAssigned = !!session.substituteTeacherId;

    // Countdown/status label
    let countdownLabel = '';
    let countdownColor = 'bg-gray-100 text-gray-600';

    if (sessionStatus === 'completed') {
        countdownLabel = '✅ Selesai';
        countdownColor = 'bg-gray-100 text-gray-600';
    } else if (sessionStatus === 'ongoing') {
        const remainMs = session.endTimeMs - nowMs;
        const remainMins = Math.floor(Math.max(0, remainMs) / 60000);
        const remainSecs = Math.floor((Math.max(0, remainMs) % 60000) / 1000);

        if (warning) {
            countdownLabel = '⚠️ BUTUH GURU!';
            countdownColor = 'bg-red-500 text-white animate-pulse';
        } else if (session.substituteCheckedIn) {
            countdownLabel = `✅ Berakhir ${remainMins}m ${remainSecs}s`;
            countdownColor = 'bg-emerald-500 text-white';
        } else {
            countdownLabel = `🔄 Berakhir ${remainMins}m ${remainSecs}s`;
            countdownColor = 'bg-amber-500 text-white';
        }
    } else {
        // upcoming
        const diffMs = session.startTimeMs - nowMs;
        const mins = Math.floor(Math.max(0, diffMs) / 60000);
        const secs = Math.floor((Math.max(0, diffMs) % 60000) / 1000);

        if (mins < 60) {
            countdownLabel = `⏰ ${mins}m ${secs}s lagi`;
            countdownColor = mins <= 15
                ? 'bg-red-100 text-red-700 animate-pulse'
                : mins <= 30
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-600';
        } else {
            countdownLabel = `⏰ ${Math.floor(mins / 60)}j ${mins % 60}m lagi`;
            countdownColor = 'bg-gray-100 text-gray-600';
        }
    }

    const timeFormatted = session.startTime.substring(0, 5);
    const endFormatted = session.endTime?.substring(0, 5) || '';

    return (
        <div
            ref={drop as any}
            className={`
                relative rounded-xl border-2 p-4 transition-all duration-200
                ${warning
                    ? 'border-red-400 bg-red-50 ring-2 ring-red-200 shadow-lg'
                    : isAssigned
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : isOver && canDrop
                            ? 'border-emerald-400 bg-emerald-50 shadow-lg ring-2 ring-emerald-200 scale-[1.02]'
                            : isOver && !canDrop
                                ? 'border-red-300 bg-red-50'
                                : sessionStatus === 'completed'
                                    ? 'border-gray-200 bg-gray-50 opacity-75'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }
            `}
        >
            {/* Countdown Badge */}
            <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${countdownColor}`}>
                    <Timer className="w-3 h-3" />
                    {countdownLabel}
                </span>
                {isAssigned && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" />
                        Ditugaskan
                    </span>
                )}
            </div>

            {/* Time + Class */}
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 text-center bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-lg px-3 py-2 min-w-[72px]">
                    <p className="text-lg font-bold leading-tight">{timeFormatted}</p>
                    <p className="text-[10px] opacity-80">{endFormatted}</p>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">{session.class?.name}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-sm text-blue-600 font-medium">{session.subject?.name}</span>
                    </div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {session.teacher?.name || 'Belum ada guru'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {session.date}
                    </p>
                </div>
            </div>

            {/* Substitute info */}
            {isAssigned && session.substituteTeacher && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                    <div className="flex items-center gap-2 text-sm">
                        <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                        <span className="text-gray-500">Pengganti:</span>
                        <span className="font-semibold text-emerald-700">{session.substituteTeacher.name}</span>
                    </div>
                </div>
            )}

            {/* Drop hint */}
            {!isAssigned && !isOver && (
                <div className="mt-3 pt-2 border-t border-dashed border-gray-200 text-center">
                    <p className="text-xs text-gray-400">Seret guru ke sini untuk menugaskan</p>
                </div>
            )}

            {isOver && canDrop && (
                <div className="absolute inset-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <p className="text-sm font-semibold text-emerald-700 bg-white/90 px-3 py-1 rounded-full shadow">
                        Lepaskan untuk menugaskan
                    </p>
                </div>
            )}
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────
const GuruPenggantiInner: React.FC = () => {
    const queryClient = useQueryClient();
    const [now, setNow] = useState(new Date());
    const [, setServerTimeOffset] = useState(0); // Sync with server time

    // Tick every 1 second for real-time countdown
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Fetch upcoming sessions (poll 10s for fresh data)
    const { data: sessionsData, isLoading: loadingSessions, refetch: refetchSessions } = useQuery({
        queryKey: ['upcoming-sessions'],
        queryFn: () => apiFetch('/api/schedules/upcoming?hours=24'),
        refetchInterval: 10_000, // 10 seconds for fresher data
    });

    // Calculate server time offset for accurate countdown
    useEffect(() => {
        if (sessionsData?.serverTimeMs) {
            const clientTimeMs = Date.now();
            setServerTimeOffset(sessionsData.serverTimeMs - clientTimeMs);
        }
    }, [sessionsData]);

    // Socket.IO for real-time updates
    useEffect(() => {
        const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin;
        const socket: Socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            withCredentials: true
        });

        socket.on('connect', () => {
            console.log('🔌 Socket connected for Guru Pengganti');
        });

        socket.on('connect_error', (err) => {
            console.warn('Socket connection error:', err.message);
        });

        // Listen for substitute assignment events
        socket.on('substitute:assigned', (data: { sessionId: number; teacherId: number; teacherName: string }) => {
            console.log('⚡ Substitute assigned:', data);
            // Instantly refresh data
            queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
            queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
        });

        // Listen for new sessions (teacher check-in)
        socket.on('session:started', () => {
            queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
            queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
        });

        // Listen for session end
        socket.on('session:ended', () => {
            queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
            queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
        });

        // Listen for teacher check-in events (regular attendance)
        socket.on('teacher:checkin', () => {
            queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
            queryClient.invalidateQueries({ queryKey: ['available-teachers'] }); // Refresh available list
        });

        // Listen for teacher checkout - remove from available list immediately
        socket.on('teacher:checkout', () => {
            queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
        });

        return () => {
            socket.off('substitute:assigned');
            socket.off('session:started');
            socket.off('session:ended');
            socket.off('teacher:checkin');
            if (socket.connected) {
                socket.disconnect();
            }
        };
    }, [queryClient]);

    // Fetch available teachers (poll 30s)
    const { data: teachersData, isLoading: loadingTeachers } = useQuery({
        queryKey: ['available-teachers'],
        queryFn: () => apiFetch('/api/schedules/available-teachers'),
        refetchInterval: 30_000,
    });

    // Assign substitute mutation
    const assignMutation = useMutation({
        mutationFn: ({ sessionId, teacherId }: { sessionId: number; teacherId: number }) =>
            apiFetch(`/api/schedules/${sessionId}/substitute/${teacherId}`, { method: 'PUT' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
            queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
        },
    });

    const handleDrop = useCallback((sessionId: number, teacherId: number) => {
        assignMutation.mutate({ sessionId, teacherId });
    }, [assignMutation]);

    const sessions: SessionItem[] = sessionsData?.sessions || [];
    const teachers: TeacherItem[] = teachersData?.teachers || [];

    const unassigned = sessions.filter((s) => !s.substituteTeacherId);
    const assigned = sessions.filter((s) => !!s.substituteTeacherId);
    const freeTeachers = teachers.filter((t) => !t.isBusy && !t.hasCheckedOut);
    const busyTeachers = teachers.filter((t) => t.isBusy || t.hasCheckedOut);

    const isLoading = loadingSessions || loadingTeachers;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <UserCheck className="w-7 h-7 text-emerald-600" />
                        Guru Pengganti
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Seret guru dari panel kanan ke sesi yang perlu pengganti
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Auto-refresh 10s | Countdown 1s
                    </span>
                    <button
                        onClick={() => refetchSessions()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-2xl font-bold text-blue-600">{sessions.length}</p>
                    <p className="text-xs text-gray-500">Total Sesi</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-2xl font-bold text-amber-600">{unassigned.length}</p>
                    <p className="text-xs text-gray-500">Perlu Pengganti</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-2xl font-bold text-emerald-600">{assigned.length}</p>
                    <p className="text-xs text-gray-500">Sudah Ditugaskan</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-2xl font-bold text-teal-600">{freeTeachers.length}</p>
                    <p className="text-xs text-gray-500">Guru Tersedia</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
                </div>
            ) : (
                /* Two-Column Layout */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT: Upcoming Sessions (2/3) */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Unassigned */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                <h2 className="text-base font-semibold text-gray-900">
                                    Sesi Perlu Pengganti
                                    <span className="ml-2 text-sm font-normal text-gray-400">({unassigned.length})</span>
                                </h2>
                            </div>

                            {unassigned.length === 0 ? (
                                <div className="text-center py-10">
                                    <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                                    <p className="font-medium text-gray-500">Semua sesi sudah ditugaskan!</p>
                                    <p className="text-sm text-gray-400 mt-1">Tidak ada sesi yang membutuhkan guru pengganti.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {unassigned.map((s) => (
                                        <DroppableSession
                                            key={s.id}
                                            session={s}
                                            onDrop={handleDrop}
                                            now={now}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Assigned */}
                        {assigned.length > 0 && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    <h2 className="text-base font-semibold text-gray-900">
                                        Sudah Ditugaskan
                                        <span className="ml-2 text-sm font-normal text-gray-400">({assigned.length})</span>
                                    </h2>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {assigned.map((s) => (
                                        <DroppableSession
                                            key={s.id}
                                            session={s}
                                            onDrop={handleDrop}
                                            now={now}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty state — no sessions needing substitute */}
                        {sessions.length === 0 && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
                                <CheckCircle2 className="w-14 h-14 text-emerald-300 mx-auto mb-4" />
                                <h3 className="font-semibold text-gray-600 text-lg">Semua Jadwal Assigned atau Kosong</h3>
                                <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
                                    Tidak ada guru yang absen hari ini, atau belum ada jadwal yang dibuat
                                    di <span className="font-medium text-gray-500">Manajemen Jadwal</span>.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Available Teachers (1/3) */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sticky top-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="w-5 h-5 text-teal-500" />
                                <h2 className="text-base font-semibold text-gray-900">
                                    Guru Tersedia
                                    <span className="ml-2 text-sm font-normal text-gray-400">({freeTeachers.length})</span>
                                </h2>
                            </div>

                            {teachers.length === 0 ? (
                                <div className="text-center py-8">
                                    <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                    <p className="text-sm font-medium text-gray-500">Semua guru sudah check-in hari ini</p>
                                    <p className="text-xs text-gray-400 mt-1">Atau belum ada guru yang check-in sebagai pengganti.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                                    {freeTeachers.map((t) => (
                                        <DraggableTeacher key={t.id} teacher={t} />
                                    ))}
                                    {busyTeachers.length > 0 && (
                                        <>
                                            <div className="flex items-center gap-2 my-3">
                                                <div className="flex-1 border-t border-gray-200" />
                                                <span className="text-xs text-gray-400">Sedang Mengajar</span>
                                                <div className="flex-1 border-t border-gray-200" />
                                            </div>
                                            {busyTeachers.map((t) => (
                                                <DraggableTeacher key={t.id} teacher={t} />
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Wrap with DndProvider ───────────────────────────────
const GuruPengganti: React.FC = () => {
    return (
        <DndProvider backend={HTML5Backend}>
            <GuruPenggantiInner />
        </DndProvider>
    );
};

export default GuruPengganti;
