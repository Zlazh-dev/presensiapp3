import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
    FileText, Calendar, Search, RefreshCw,
    Stethoscope, Clock, Filter, AlertCircle,
    Paperclip, BookOpen, X, Download, Eye,
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
    assignmentText: string | null;
    attachmentUrl: string | null;
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

// ─── Assignment Badge ────────────────────────────────────
const AssignmentIndicator: React.FC<{ row: LeaveRow }> = ({ row }) => {
    const hasFile = !!row.attachmentUrl;
    const hasText = !!row.assignmentText;

    if (!hasFile && !hasText) {
        return <span className="text-xs text-gray-300">—</span>;
    }

    return (
        <div className="flex items-center gap-1.5">
            {hasFile && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <Paperclip className="w-3 h-3" />
                    File
                </span>
            )}
            {hasText && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <BookOpen className="w-3 h-3" />
                    Teks
                </span>
            )}
        </div>
    );
};

// ─── Detail Modal ────────────────────────────────────────
const LeaveDetailModal: React.FC<{ row: LeaveRow | null; onClose: () => void }> = ({ row, onClose }) => {
    if (!row) return null;

    const handleDownload = () => {
        if (row.attachmentUrl) {
            // Use the backend API base URL
            const baseUrl = (api.defaults.baseURL || '').replace('/api', '');
            window.open(`${baseUrl}${row.attachmentUrl}`, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-900">Detail Izin/Sakit</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Teacher info */}
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${row.status === 'sick' ? 'bg-blue-100' : 'bg-purple-100'
                            }`}>
                            {row.status === 'sick' ? (
                                <Stethoscope className="w-6 h-6 text-blue-600" />
                            ) : (
                                <FileText className="w-6 h-6 text-purple-600" />
                            )}
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">{row.teacherName}</p>
                            <p className="text-sm text-gray-500">{row.employeeId}</p>
                        </div>
                        <div className="ml-auto">
                            <LeaveBadge status={row.status} label={row.statusLabel} />
                        </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 mb-1">Tanggal</p>
                            <p className="text-sm font-medium text-gray-800">
                                {format(new Date(row.date), 'dd MMMM yyyy', { locale: localeId })}
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 mb-1">Diajukan</p>
                            <p className="text-sm font-medium text-gray-800">
                                {row.createdAt ? format(new Date(row.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId }) : '-'}
                            </p>
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Alasan</p>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-sm text-gray-700 leading-relaxed">
                                {row.notes || <span className="text-gray-300 italic">Tidak ada keterangan</span>}
                            </p>
                        </div>
                    </div>

                    {/* Assignment Text */}
                    {row.assignmentText && (
                        <div>
                            <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                Tugas Tertulis
                            </p>
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {row.assignmentText}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Attachment */}
                    {row.attachmentUrl && (
                        <div>
                            <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1">
                                <Paperclip className="w-3 h-3" />
                                File Tugas
                            </p>
                            <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                                    <Paperclip className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                        {row.attachmentUrl.split('/').pop()}
                                    </p>
                                </div>
                                <button
                                    onClick={handleDownload}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition flex-shrink-0"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                </button>
                            </div>
                        </div>
                    )}

                    {/* No assignment */}
                    {!row.assignmentText && !row.attachmentUrl && (
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-400 italic">Tidak ada tugas yang disertakan</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
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
    const [selectedRow, setSelectedRow] = useState<LeaveRow | null>(null);

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
                        <table className="w-full text-sm min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50/80">
                                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Tanggal</th>
                                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Nama Guru</th>
                                    <th className="px-5 py-3 text-left font-semibold text-gray-600">NIP</th>
                                    <th className="px-5 py-3 text-center font-semibold text-gray-600">Status</th>
                                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Alasan</th>
                                    <th className="px-5 py-3 text-center font-semibold text-gray-600">Tugas</th>
                                    <th className="px-5 py-3 text-center font-semibold text-gray-600">Detail</th>
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
                                        <td className="px-5 py-3.5 max-w-[200px]">
                                            {r.notes ? (
                                                <div className="flex items-start gap-1.5">
                                                    <AlertCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                    <span className="text-gray-700 text-sm leading-snug truncate">{r.notes}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-sm">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <AssignmentIndicator row={r} />
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <button
                                                onClick={() => setSelectedRow(r)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                Lihat
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <LeaveDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
        </div>
    );
};

export default IzinGuru;
