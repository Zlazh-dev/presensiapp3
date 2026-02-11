import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Printer, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface TimeSlot {
    id: number;
    slotNumber: number;
    startTime: string;
    endTime: string;
}

interface SlotData {
    scheduleId: number;
    className: string;
    classId: number;
    subject: string;
    subjectCode: string;
}

interface GridRow {
    day: string;
    dayNumber: number;
    slots: (SlotData | null)[];
}

// ─── API ──────────────────────────────────────────────────────
const fetchMySchedule = async () => {
    const res = await fetch('/api/schedules/my-schedule', {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

// ─── Day colors ───────────────────────────────────────────────
const dayColors: Record<string, { bg: string; text: string; border: string; cell: string }> = {
    Senin: { bg: 'bg-blue-600', text: 'text-white', border: 'border-l-blue-500', cell: 'bg-blue-50 text-blue-900' },
    Selasa: { bg: 'bg-emerald-600', text: 'text-white', border: 'border-l-emerald-500', cell: 'bg-emerald-50 text-emerald-900' },
    Rabu: { bg: 'bg-amber-500', text: 'text-white', border: 'border-l-amber-500', cell: 'bg-amber-50 text-amber-900' },
    Kamis: { bg: 'bg-purple-600', text: 'text-white', border: 'border-l-purple-500', cell: 'bg-purple-50 text-purple-900' },
    Jumat: { bg: 'bg-rose-500', text: 'text-white', border: 'border-l-rose-500', cell: 'bg-rose-50 text-rose-900' },
    Sabtu: { bg: 'bg-cyan-600', text: 'text-white', border: 'border-l-cyan-500', cell: 'bg-cyan-50 text-cyan-900' },
};

// ─── Component ────────────────────────────────────────────────
const JadwalSaya: React.FC = () => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['mySchedule'],
        queryFn: fetchMySchedule,
    });

    const grid: GridRow[] = data?.grid || [];
    const timeSlots: TimeSlot[] = data?.timeSlots || [];
    const teacherName: string = data?.teacherName || '';

    // Count total lessons
    const totalLessons = grid.reduce((sum, row) => sum + row.slots.filter(s => s !== null).length, 0);

    // Check if there are lessons on a given day
    const hasLessons = (row: GridRow) => row.slots.some(s => s !== null);

    // Only show days that have at least one lesson
    const activeDays = grid.filter(hasLessons);

    return (
        <div className="space-y-6 print:space-y-2">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-6 sm:w-7 h-6 sm:h-7 text-blue-600 flex-shrink-0" />
                        Jadwal Saya
                    </h1>
                    <p className="text-sm sm:text-base text-gray-500 mt-1">
                        Jadwal mengajar Anda minggu ini
                        {teacherName && <span className="font-medium text-gray-700"> — {teacherName}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {totalLessons > 0 && (
                        <span className="text-xs sm:text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium">
                            {totalLessons} jam pelajaran
                        </span>
                    )}
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm font-medium"
                    >
                        <Printer className="w-4 h-4" />
                        Cetak
                    </button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block text-center mb-4">
                <h1 className="text-xl font-bold">Jadwal Mengajar — {teacherName}</h1>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="ml-3 text-gray-500">Memuat jadwal...</span>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm">
                    Gagal memuat jadwal. Silakan refresh halaman.
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && totalLessons === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                    <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600">Belum ada jadwal</h3>
                    <p className="text-sm text-gray-400 mt-1">Hubungi admin untuk mengatur jadwal Anda.</p>
                </div>
            )}

            {/* Schedule Grid */}
            {!isLoading && !error && totalLessons > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="text-left py-3 px-4 font-semibold text-gray-500 uppercase text-xs w-24 min-w-[96px]">
                                        Hari
                                    </th>
                                    {timeSlots.map(ts => (
                                        <th key={ts.id} className="text-center py-3 px-2 font-semibold text-gray-500 uppercase text-xs min-w-[110px]">
                                            <div>Jam {ts.slotNumber}</div>
                                            <div className="font-normal text-gray-400 mt-0.5">
                                                {ts.startTime}–{ts.endTime}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {activeDays.map(row => {
                                    const colors = dayColors[row.day] || dayColors.Senin;
                                    return (
                                        <tr key={row.day} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                                            <td className={`py-3 px-4 font-bold text-sm border-l-4 ${colors.border}`}>
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${colors.bg} ${colors.text}`}>
                                                    {row.day}
                                                </span>
                                            </td>
                                            {row.slots.map((slot, slotIdx) => (
                                                <td key={slotIdx} className="py-2 px-2 text-center">
                                                    {slot ? (
                                                        <div className={`rounded-xl px-2 py-2.5 ${colors.cell} border border-black/5`}>
                                                            <div className="font-bold text-sm leading-tight">{slot.className}</div>
                                                            <div className="text-xs mt-0.5 opacity-75">{slot.subject}</div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-gray-300 text-xs">—</div>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Summary Cards (mobile friendly) */}
            {!isLoading && !error && totalLessons > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
                    {grid.map(row => {
                        const count = row.slots.filter(s => s !== null).length;
                        const colors = dayColors[row.day] || dayColors.Senin;
                        return (
                            <div
                                key={row.day}
                                className={`${count > 0 ? 'bg-white border border-gray-100' : 'bg-gray-50 border border-gray-100 opacity-50'} rounded-xl p-3 text-center shadow-sm`}
                            >
                                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${count > 0 ? `${colors.bg} ${colors.text}` : 'bg-gray-200 text-gray-500'}`}>
                                    {row.day}
                                </span>
                                <div className="mt-2 text-2xl font-bold text-gray-800">{count}</div>
                                <div className="text-xs text-gray-400">jam</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default JadwalSaya;
