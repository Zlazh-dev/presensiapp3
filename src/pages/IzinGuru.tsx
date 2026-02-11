import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
    FileText, Calendar, Search, RefreshCw,
    Stethoscope, Clock, Filter, AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';

// ─── Types ───────────────────────────────────────────────
interface LeaveRow {
    id: number;
    date: string;
    teacherId: number;
    teacherName: string;
    employeeId: string;
    phone: string;
    status: 'sick' | 'permission';
    statusLabel: string;
    notes: string | null;
    createdAt: string;
}

interface LeaveSummary {
    total: number;
    sick: number;
    permission: number;
}

// ─── Status Badge ────────────────────────────────────────
const LeaveBadge: React.FC<{ status: string; label: string }> = ({ status, label }) => {
    const config = status === 'sick'
        ? { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <Stethoscope className="w-3 h-3" /> }
        : { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: <FileText className="w-3 h-3" /> };
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${config.bg} ${config.text} border ${config.border}`}>
            {config.icon}
            {label}
        </span>
    );
};

// ─── Main Component ──────────────────────────────────────
const IzinGuru: React.FC = () => {
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: format(subDays(today, 30), 'yyyy-MM-dd'),
        end: format(today, 'yyyy-MM-dd'),
    });
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['teacher-leaves', dateRange.start, dateRange.end, statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams({
                start: dateRange.start,
                end: dateRange.end,
            });
            if (statusFilter) params.set('status', statusFilter);
            const res = await api.get(`/admin/teacher-leaves?${params.toString()}`);
            return res.data as { rows: LeaveRow[]; summary: LeaveSummary };
        },
    });

    const rows = data?.rows || [];
    const summary = data?.summary || { total: 0, sick: 0, permission: 0 };

    // Client-side search filtering
    const filteredRows = useMemo(() => {
        if (!searchQuery.trim()) return rows;
        const q = searchQuery.toLowerCase();
        return rows.filter(r =>
            r.teacherName.toLowerCase().includes(q) ||
            r.employeeId.toLowerCase().includes(q)
        );
    }, [rows, searchQuery]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="w-7 h-7 text-purple-600" />
                        Izin & Sakit Guru
                    </h1>
                    <p className="text-gray-500 mt-1">Daftar pengajuan izin dan sakit oleh guru</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition self-start"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Pengajuan</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-gray-50">
                            <FileText className="w-5 h-5 text-gray-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-blue-500 uppercase tracking-wide">Sakit</p>
                            <p className="text-2xl font-bold text-blue-700 mt-1">{summary.sick}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-blue-50">
                            <Stethoscope className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-purple-500 uppercase tracking-wide">Izin</p>
                            <p className="text-2xl font-bold text-purple-700 mt-1">{summary.permission}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-purple-50">
                            <Clock className="w-5 h-5 text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Date range */}
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm flex-1 sm:flex-none">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-1 py-0.5 border-0 text-sm focus:outline-none bg-transparent min-w-0"
                    />
                    <span className="text-gray-300">—</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-1 py-0.5 border-0 text-sm focus:outline-none bg-transparent min-w-0"
                    />
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-sm border-0 focus:outline-none bg-transparent text-gray-700"
                    >
                        <option value="">Semua Status</option>
                        <option value="sick">Sakit</option>
                        <option value="permission">Izin</option>
                    </select>
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm flex-1">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari nama guru..."
                        className="text-sm border-0 focus:outline-none bg-transparent w-full"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm">Tidak ada data izin/sakit dalam periode ini</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[700px]">
                            <thead>
                                <tr className="bg-gray-50/80">
                                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Tanggal</th>
                                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Nama Guru</th>
                                    <th className="px-5 py-3 text-left font-semibold text-gray-600">NIP</th>
                                    <th className="px-5 py-3 text-center font-semibold text-gray-600">Status</th>
                                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Alasan</th>
                                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Diajukan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredRows.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50/50 transition">
                                        <td className="px-5 py-3.5 font-medium text-gray-900">
                                            {format(new Date(r.date), 'dd MMM yyyy', { locale: localeId })}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div>
                                                <p className="text-gray-900 font-medium">{r.teacherName}</p>
                                                {r.phone !== '-' && (
                                                    <p className="text-xs text-gray-400 mt-0.5">{r.phone}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-gray-500">{r.employeeId}</td>
                                        <td className="px-5 py-3.5 text-center">
                                            <LeaveBadge status={r.status} label={r.statusLabel} />
                                        </td>
                                        <td className="px-5 py-3.5 max-w-[250px]">
                                            {r.notes ? (
                                                <div className="flex items-start gap-1.5">
                                                    <AlertCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                    <span className="text-gray-700 text-sm leading-snug">{r.notes}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-sm">Tidak ada keterangan</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-gray-400 text-xs">
                                            {r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId }) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IzinGuru;
