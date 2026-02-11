import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../services/adminApi';
import { format, subDays } from 'date-fns';
import {
    BarChart3, TrendingUp, Award, Clock, Users,
    Calendar, Loader2, Trophy, Medal,
} from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────
interface TrendItem {
    date: string;
    hadir: number;
    total: number;
    pct: number;
}
interface RankingItem {
    teacherId: number;
    name: string;
    hadir: number;
    total: number;
    pct: number;
    late: number;
}
interface HeatmapItem {
    day: number;
    hour: number;
    lateCount: number;
}
interface ReportCardItem {
    teacherId: number;
    name: string;
    hadir: number;
    telat: number;
    izin: number;
    sakit: number;
    alpha: number;
    total: number;
}

// ─── Day/Hour labels ─────────────────────────────────────
const DAY_LABELS = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ─── Heatmap Color ───────────────────────────────────────
const getHeatColor = (count: number, max: number): string => {
    if (count === 0) return 'bg-gray-50';
    const intensity = max > 0 ? count / max : 0;
    if (intensity > 0.75) return 'bg-red-500 text-white';
    if (intensity > 0.5) return 'bg-orange-400 text-white';
    if (intensity > 0.25) return 'bg-amber-300 text-amber-900';
    return 'bg-amber-100 text-amber-800';
};

// ─── Trend Chart Section ─────────────────────────────────
const TrendChart: React.FC<{ data: TrendItem[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Belum ada data tren</p>
            </div>
        );
    }

    const chartData = data.map(d => ({
        ...d,
        label: format(new Date(d.date), 'dd/MM'),
    }));

    return (
        <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                    <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '13px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                    }}
                    formatter={(value: any) => [`${value}%`, 'Kehadiran']}
                    labelFormatter={(label) => `Tanggal: ${label}`}
                />
                <Area
                    type="monotone"
                    dataKey="pct"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#colorPct)"
                    dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#059669', strokeWidth: 2, stroke: '#fff' }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

// ─── Ranking / Leaderboard Section ───────────────────────
const RankingTable: React.FC<{ data: RankingItem[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <Award className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Belum ada data ranking</p>
            </div>
        );
    }

    const getMedal = (idx: number) => {
        if (idx === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
        if (idx === 1) return <Medal className="w-5 h-5 text-gray-400" />;
        if (idx === 2) return <Medal className="w-5 h-5 text-amber-600" />;
        return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-gray-400">#{idx + 1}</span>;
    };

    const getPctColor = (pct: number) => {
        if (pct >= 90) return 'text-emerald-600';
        if (pct >= 75) return 'text-blue-600';
        if (pct >= 50) return 'text-amber-600';
        return 'text-red-600';
    };

    const getBarColor = (pct: number) => {
        if (pct >= 90) return 'bg-emerald-500';
        if (pct >= 75) return 'bg-blue-500';
        if (pct >= 50) return 'bg-amber-500';
        return 'bg-red-500';
    };

    return (
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {data.map((item, idx) => (
                <div key={item.teacherId} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${idx < 3 ? 'bg-gradient-to-r from-gray-50 to-white border border-gray-100' : 'hover:bg-gray-50'}`}>
                    <div className="flex-shrink-0 w-8 flex justify-center">
                        {getMedal(idx)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-800 text-sm truncate">{item.name}</span>
                            <span className={`font-bold text-sm ${getPctColor(item.pct)}`}>{item.pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${getBarColor(item.pct)}`}
                                style={{ width: `${item.pct}%` }}
                            />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span>{item.hadir}/{item.total} hadir</span>
                            {item.late > 0 && (
                                <span className="text-amber-500">⏰ {item.late}× telat</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─── Heatmap Section ─────────────────────────────────────
const LateHeatmap: React.FC<{ data: HeatmapItem[] }> = ({ data }) => {
    const maxCount = useMemo(() => Math.max(...data.map(d => d.lateCount), 1), [data]);
    const hasData = data.some(d => d.lateCount > 0);

    if (!hasData) {
        return (
            <div className="text-center py-12 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Tidak ada data keterlambatan</p>
            </div>
        );
    }

    // Group by hour
    const hours = Array.from({ length: 12 }, (_, i) => i + 6); // 6..17

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[360px]">
                {/* Header */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    <div className="text-xs text-gray-400 font-medium text-right pr-1">Jam</div>
                    {DAY_LABELS.slice(1).map(d => (
                        <div key={d} className="text-xs text-gray-500 font-semibold text-center">{d}</div>
                    ))}
                </div>
                {/* Grid */}
                {hours.map(hour => (
                    <div key={hour} className="grid grid-cols-7 gap-1 mb-1">
                        <div className="text-xs text-gray-400 text-right pr-1 flex items-center justify-end">
                            {String(hour).padStart(2, '0')}:00
                        </div>
                        {[1, 2, 3, 4, 5, 6].map(day => {
                            const cell = data.find(d => d.day === day && d.hour === hour);
                            const count = cell?.lateCount || 0;
                            return (
                                <div
                                    key={`${day}-${hour}`}
                                    className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-colors cursor-default ${getHeatColor(count, maxCount)}`}
                                    title={`${DAY_LABELS[day]} ${String(hour).padStart(2, '0')}:00 — ${count} keterlambatan`}
                                >
                                    {count > 0 ? count : ''}
                                </div>
                            );
                        })}
                    </div>
                ))}
                {/* Legend */}
                <div className="flex items-center gap-2 mt-3 justify-center">
                    <span className="text-xs text-gray-400">Sedikit</span>
                    <div className="flex gap-1">
                        <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
                        <div className="w-4 h-4 rounded bg-amber-100" />
                        <div className="w-4 h-4 rounded bg-amber-300" />
                        <div className="w-4 h-4 rounded bg-orange-400" />
                        <div className="w-4 h-4 rounded bg-red-500" />
                    </div>
                    <span className="text-xs text-gray-400">Banyak</span>
                </div>
            </div>
        </div>
    );
};

// ─── Report Card Section ─────────────────────────────────
const ReportCardTable: React.FC<{ data: ReportCardItem[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Belum ada data rapor</p>
            </div>
        );
    }

    const getStatusPill = (value: number, color: string) => {
        if (value === 0) return <span className="text-gray-300">0</span>;
        return <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{value}</span>;
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left">
                        <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Guru</th>
                        <th className="pb-3 px-2 text-center text-xs font-semibold text-emerald-600 uppercase tracking-wider">Hadir</th>
                        <th className="pb-3 px-2 text-center text-xs font-semibold text-amber-600 uppercase tracking-wider">Telat</th>
                        <th className="pb-3 px-2 text-center text-xs font-semibold text-blue-600 uppercase tracking-wider">Izin</th>
                        <th className="pb-3 px-2 text-center text-xs font-semibold text-orange-600 uppercase tracking-wider">Sakit</th>
                        <th className="pb-3 px-2 text-center text-xs font-semibold text-red-600 uppercase tracking-wider">Alpha</th>
                        <th className="pb-3 pl-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="pb-3 pl-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kehadiran</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.map((item) => {
                        const attendPct = item.total > 0 ? Math.round(((item.hadir + item.telat) / item.total) * 100) : 0;
                        return (
                            <tr key={item.teacherId} className="hover:bg-gray-50 transition-colors">
                                <td className="py-3 pr-4">
                                    <span className="font-medium text-gray-800">{item.name}</span>
                                </td>
                                <td className="py-3 px-2 text-center">{getStatusPill(item.hadir, 'bg-emerald-100 text-emerald-700')}</td>
                                <td className="py-3 px-2 text-center">{getStatusPill(item.telat, 'bg-amber-100 text-amber-700')}</td>
                                <td className="py-3 px-2 text-center">{getStatusPill(item.izin, 'bg-blue-100 text-blue-700')}</td>
                                <td className="py-3 px-2 text-center">{getStatusPill(item.sakit, 'bg-orange-100 text-orange-700')}</td>
                                <td className="py-3 px-2 text-center">{getStatusPill(item.alpha, 'bg-red-100 text-red-700')}</td>
                                <td className="py-3 pl-2 text-center text-gray-500 font-medium">{item.total}</td>
                                <td className="py-3 pl-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 bg-gray-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${attendPct >= 90 ? 'bg-emerald-500' : attendPct >= 75 ? 'bg-blue-500' : attendPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                style={{ width: `${attendPct}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-gray-600">{attendPct}%</span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ─── Main Analitik Component ─────────────────────────────
const Analitik: React.FC = () => {
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: format(subDays(today, 30), 'yyyy-MM-dd'),
        end: format(today, 'yyyy-MM-dd'),
    });

    const { data, isLoading } = useQuery({
        queryKey: ['analytics', dateRange.start, dateRange.end],
        queryFn: () => adminApi.getAnalytics(dateRange.start, dateRange.end),
    });

    const trend: TrendItem[] = data?.trend || [];
    const ranking: RankingItem[] = data?.ranking || [];
    const heatmap: HeatmapItem[] = data?.heatmap || [];
    const reportCard: ReportCardItem[] = data?.reportCard || [];

    // Quick stats from trend data
    const avgPct = trend.length > 0 ? Math.round(trend.reduce((s, t) => s + t.pct, 0) / trend.length) : 0;
    const totalRecords = trend.reduce((s, t) => s + t.total, 0);
    const totalLate = ranking.reduce((s, r) => s + r.late, 0);

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-indigo-600" />
                        Analitik Kehadiran
                    </h1>
                    <p className="text-gray-500 mt-1">Dashboard analitik kehadiran guru</p>
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2 shadow-sm">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="text-sm border-none outline-none bg-transparent text-gray-700 w-32"
                    />
                    <span className="text-gray-300">→</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="text-sm border-none outline-none bg-transparent text-gray-700 w-32"
                    />
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rata-rata Kehadiran</p>
                            <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : `${avgPct}%`}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Record</p>
                            <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : totalRecords}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Clock className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Keterlambatan</p>
                            <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : totalLate}</p>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            )}

            {!isLoading && (
                <>
                    {/* Row 1: Trend + Ranking */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Trend Chart */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                                    Tren Kehadiran
                                </h2>
                                <span className="text-xs text-gray-400">{trend.length} hari</span>
                            </div>
                            <TrendChart data={trend} />
                        </div>

                        {/* Ranking */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Award className="w-5 h-5 text-yellow-500" />
                                    Ranking Guru
                                </h2>
                                <span className="text-xs text-gray-400">{ranking.length} guru</span>
                            </div>
                            <RankingTable data={ranking} />
                        </div>
                    </div>

                    {/* Row 2: Heatmap + Report Card */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Heatmap */}
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-amber-500" />
                                    Pola Keterlambatan
                                </h2>
                            </div>
                            <LateHeatmap data={heatmap} />
                        </div>

                        {/* Report Card */}
                        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-indigo-500" />
                                    Rapor Kehadiran Guru
                                </h2>
                                <span className="text-xs text-gray-400">{reportCard.length} guru</span>
                            </div>
                            <ReportCardTable data={reportCard} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Analitik;
