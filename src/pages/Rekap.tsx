import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
    ClipboardList, Users, UserCheck, Calendar, Download,
    ChevronDown, ChevronRight, BookOpen, TrendingUp,
    RefreshCw, GraduationCap, FileText, AlertCircle, Clock,
    CheckCircle, XCircle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ───────────────────────────────────────────────
interface GuruRegularRow {
    id: number;
    date: string;
    teacherId: number;
    teacherName: string;
    employeeId: string;
    status: string;
    lateMinutes: number | null;
    statusLabel: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    earlyCheckoutMinutes: number | null;
    checkoutStatusLabel: string | null;
    notes: string | null;
}

// Type for per-session teaching attendance (Single Source of Truth)
interface GuruMengajarRow {
    id: number;
    date: string;
    teacherId: number;
    teacherName: string;
    employeeId: string;
    className: string;
    subjectName: string;
    status: string;
    statusLabel: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    durationMinutes: number;
    sessionStatus: string;
    notes: string | null;
    isSubstitute: boolean;
}

interface GuruClassSummary {
    classId: number;
    className: string;
    totalSessions: number;
    attended: number;
    absent: number;
    percentage: number;
    sessions: Array<{
        date: string;
        startTime: string;
        subject: string;
        teacher: string;
        status: string;
    }>;
}

interface SiswaSummary {
    classId: number;
    className: string;
    totalStudents: number;
    totalSessions: number;
    present: number;
    absent: number;
    sick: number;
    permission: number;
    late: number;
    percentage: number;
}

interface SiswaDetail {
    studentId: number;
    nis: string;
    name: string;
    gender: string;
    totalSessions: number;
    present: number;
    absent: number;
    sick: number;
    permission: number;
    late: number;
    percentage: number;
}

// ─── API ─────────────────────────────────────────────────
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

const apiDownload = async (url: string, body: any, filename: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
};

// ─── Status Badge ────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        present: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Hadir' },
        late: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Terlambat' },
        absent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Absen' },
        sick: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sakit' },
        permission: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Izin' },
        alpha: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Tanpa Keterangan' },
        no_record: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Tidak ada data' },
    };
    const c = config[status] || config.no_record;
    return (
        <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
            {c.label}
        </span>
    );
};

// ─── Stat Card ───────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string }> = ({
    label, value, icon, color,
}) => (
    <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
            <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide truncate">{label}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
            <div className={`p-2.5 sm:p-3 rounded-xl ${color} flex-shrink-0`}>
                {icon}
            </div>
        </div>
    </div>
);

// ─── Status Breakdown Bar ────────────────────────────────
const StatusBreakdown: React.FC<{
    rows: Array<{ status: string }>;
    description?: string;
}> = ({ rows, description }) => {
    const counts = useMemo(() => {
        const c = { present: 0, late: 0, permission: 0, sick: 0, alpha: 0, absent: 0 };
        rows.forEach((r) => {
            const s = r.status as keyof typeof c;
            if (s in c) c[s]++;
        });
        return c;
    }, [rows]);
    const total = rows.length;
    if (total === 0) return null;

    const items = [
        { label: 'Hadir', count: counts.present, color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50' },
        { label: 'Terlambat', count: counts.late, color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50' },
        { label: 'Izin', count: counts.permission, color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50' },
        { label: 'Sakit', count: counts.sick, color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50' },
        { label: 'Alpha', count: counts.alpha + counts.absent, color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50' },
    ];

    return (
        <div className="mb-4 space-y-3">
            {description && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                    {description}
                </p>
            )}
            {/* Stacked progress bar */}
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
                {items.map((item) =>
                    item.count > 0 ? (
                        <div
                            key={item.label}
                            className={`${item.color} transition-all duration-500`}
                            style={{ width: `${(item.count / total) * 100}%` }}
                            title={`${item.label}: ${item.count}`}
                        />
                    ) : null
                )}
            </div>
            {/* Count pills */}
            <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                    <div key={item.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${item.bgLight} ${item.count === 0 ? 'opacity-40' : ''}`}>
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className={`text-xs font-semibold ${item.textColor}`}>{item.count}</span>
                        <span className="text-xs text-gray-500">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Guru Reguler Tab ────────────────────────────────────
const GuruReguler: React.FC<{ start: string; end: string; forceGuruId?: number }> = ({ start, end, forceGuruId }) => {
    const [selectedGuruId, setSelectedGuruId] = useState<string>('');
    const effectiveGuruId = forceGuruId ? String(forceGuruId) : selectedGuruId;

    const { data, isLoading } = useQuery({
        queryKey: ['guru-regular', start, end, effectiveGuruId],
        queryFn: () => apiFetch(`/api/attendance/guru/regular?start=${start}&end=${end}${effectiveGuruId ? `&guruId=${effectiveGuruId}` : ''}`),
        enabled: !!start && !!end,
    });

    const rows: GuruRegularRow[] = data?.rows || [];

    // Extract unique teachers for dropdown
    const teachers = useMemo(() => {
        const map = new Map<number, { id: number; name: string }>();
        rows.forEach((r) => {
            if (!map.has(r.teacherId)) {
                map.set(r.teacherId, { id: r.teacherId, name: r.teacherName });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [rows]);

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14);
        doc.text('Rekap Kehadiran Guru', 14, 15);
        doc.setFontSize(9);
        doc.text(`Periode: ${start} s/d ${end}${selectedGuruId ? ` — ${rows[0]?.teacherName || ''}` : ''}`, 14, 22);

        autoTable(doc, {
            startY: 28,
            head: [['Tanggal', 'Guru', 'NIP', 'Status', 'Jam Masuk', 'Jam Keluar', 'Status Checkout']],
            body: rows.map((r) => [
                format(new Date(r.date), 'dd MMM yyyy', { locale: localeId }),
                r.teacherName,
                r.employeeId || '-',
                r.statusLabel || r.status,
                r.checkInTime?.substring(0, 5) || '-',
                r.checkOutTime?.substring(0, 5) || '-',
                r.checkoutStatusLabel || '-',
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] },
        });

        doc.save(`rekap_guru_${start}_${end}.pdf`);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                        <ClipboardList className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        Kehadiran Reguler — {rows.length} data
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Guru filter dropdown - hidden when forceGuruId is set (teacher role) */}
                        {!forceGuruId && (
                            <select
                                value={selectedGuruId}
                                onChange={(e) => setSelectedGuruId(e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none flex-1 sm:flex-none min-w-0"
                            >
                                <option value="">Semua Guru</option>
                                {teachers.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        )}

                        {/* PDF Export */}
                        <button
                            onClick={handleExportPDF}
                            disabled={rows.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-40"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Cetak</span> PDF
                        </button>

                        {/* Excel Export */}
                        <button
                            onClick={() => apiDownload('/api/attendance/export/guru-regular', { start, end }, `rekap_guru_${start}_${end}.xlsx`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Excel
                        </button>
                    </div>
                </div>
            </div>
            <StatusBreakdown
                rows={rows}
                description="Kehadiran harian guru (check-in/check-out) di luar sesi mengajar"
            />
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p>Tidak ada data kehadiran dalam rentang tanggal ini.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                        <thead>
                            <tr className="bg-gray-50/80">
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Tanggal</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Guru</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">NIP</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Status</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Jam Masuk</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Jam Keluar</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Status Checkout</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Catatan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map((r) => (
                                <tr key={r.id} className="hover:bg-gray-50/50 transition">
                                    <td className="px-5 py-3 font-medium text-gray-900">
                                        {format(new Date(r.date), 'dd MMM yyyy', { locale: localeId })}
                                    </td>
                                    <td className="px-5 py-3 text-gray-800">{r.teacherName}</td>
                                    <td className="px-5 py-3 text-gray-500">{r.employeeId}</td>
                                    <td className="px-5 py-3 text-center"><StatusBadge status={r.status} /></td>
                                    <td className="px-5 py-3 text-center text-gray-600">{r.checkInTime?.substring(0, 5) || '-'}</td>
                                    <td className="px-5 py-3 text-center text-gray-600">{r.checkOutTime?.substring(0, 5) || '-'}</td>
                                    <td className="px-5 py-3 text-center">
                                        {r.checkoutStatusLabel ? (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.earlyCheckoutMinutes
                                                ? 'bg-red-50 text-red-700'
                                                : 'bg-green-50 text-green-700'
                                                }`}>
                                                {r.checkoutStatusLabel}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-gray-500 max-w-[200px]">
                                        {(r.status === 'sick' || r.status === 'permission') && r.notes ? (
                                            <span className="inline-flex items-center gap-1 text-xs">
                                                <AlertCircle className="w-3 h-3 text-gray-400" />
                                                <span className="truncate">{r.notes}</span>
                                            </span>
                                        ) : r.notes ? (
                                            <span className="truncate text-xs">{r.notes}</span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── Guru Per Sesi Mengajar (KBM) Tab ────────────────────
// SINGLE SOURCE OF TRUTH: Uses ONLY sessions table
const GuruMengajar: React.FC<{ start: string; end: string; forceGuruId?: number }> = ({ start, end, forceGuruId }) => {
    const [selectedGuruId, setSelectedGuruId] = useState<string>('');
    const effectiveGuruId = forceGuruId ? String(forceGuruId) : selectedGuruId;

    const { data, isLoading } = useQuery({
        queryKey: ['guru-mengajar', start, end, effectiveGuruId],
        queryFn: () => apiFetch(`/api/attendance/guru/mengajar?start=${start}&end=${end}${effectiveGuruId ? `&guruId=${effectiveGuruId}` : ''}`),
        enabled: !!start && !!end,
    });

    const rows: GuruMengajarRow[] = data?.rows || [];

    // Extract unique teachers for dropdown
    const teachers = useMemo(() => {
        const map = new Map<number, { id: number; name: string }>();
        rows.forEach((r) => {
            if (!map.has(r.teacherId)) {
                map.set(r.teacherId, { id: r.teacherId, name: r.teacherName });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [rows]);

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14);
        doc.text('Rekap Kehadiran Mengajar (KBM)', 14, 15);
        doc.setFontSize(9);
        doc.text(`Periode: ${start} s/d ${end}${selectedGuruId ? ` — ${rows[0]?.teacherName || ''}` : ''}`, 14, 22);

        autoTable(doc, {
            startY: 28,
            head: [['Tanggal', 'Guru', 'Kelas', 'Mapel', 'Jam Masuk', 'Jam Keluar', 'Durasi', 'Status']],
            body: rows.map((r) => [
                format(new Date(r.date), 'dd MMM yyyy', { locale: localeId }),
                r.teacherName,
                r.className,
                r.subjectName,
                r.checkInTime?.substring(0, 5) || '-',
                r.checkOutTime?.substring(0, 5) || '-',
                r.durationMinutes > 0 ? `${r.durationMinutes} menit` : '-',
                r.statusLabel,
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [16, 185, 129] },
        });

        doc.save(`rekap_mengajar_${start}_${end}.pdf`);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                        <BookOpen className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>Mengajar (KBM) — {rows.length} sesi</span>
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Guru filter dropdown - hidden when forceGuruId is set (teacher role) */}
                        {!forceGuruId && (
                            <select
                                value={selectedGuruId}
                                onChange={(e) => setSelectedGuruId(e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none flex-1 sm:flex-none min-w-0"
                            >
                                <option value="">Semua Guru</option>
                                {teachers.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        )}

                        {/* PDF Export */}
                        <button
                            onClick={handleExportPDF}
                            disabled={rows.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-40"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            PDF
                        </button>
                    </div>
                </div>
            </div>
            <StatusBreakdown
                rows={rows}
                description="Kehadiran guru per sesi KBM — terlambat jika check-in >10 menit setelah jadwal"
            />
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p>Tidak ada data sesi mengajar dalam rentang tanggal ini.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[650px]">
                        <thead>
                            <tr className="bg-gray-50/80">
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Tanggal</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Guru</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Kelas</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Mapel</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Masuk</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Keluar</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Durasi</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Sesi</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Status</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Catatan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map((r) => (
                                <tr key={r.id} className="hover:bg-gray-50/50 transition">
                                    <td className="px-5 py-3 font-medium text-gray-900">
                                        {format(new Date(r.date), 'dd MMM yyyy', { locale: localeId })}
                                    </td>
                                    <td className="px-5 py-3 text-gray-800">
                                        {r.teacherName}
                                        {r.isSubstitute && (
                                            <span className="ml-1 text-xs text-orange-600">(Pengganti)</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-gray-700 font-medium">{r.className}</td>
                                    <td className="px-5 py-3 text-gray-600">{r.subjectName}</td>
                                    <td className="px-5 py-3 text-center text-gray-600">{r.checkInTime?.substring(0, 5) || '-'}</td>
                                    <td className="px-5 py-3 text-center text-gray-600">{r.checkOutTime?.substring(0, 5) || '-'}</td>
                                    <td className="px-5 py-3 text-center">
                                        {r.durationMinutes > 0 ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                {r.durationMinutes} menit
                                            </span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        {r.sessionStatus === 'completed' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                                                <CheckCircle className="w-3 h-3" />
                                                Tuntas
                                            </span>
                                        ) : r.sessionStatus === 'active' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                                                <Clock className="w-3 h-3" />
                                                Aktif
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                                <XCircle className="w-3 h-3" />
                                                Belum
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'alpha'
                                            ? 'bg-orange-50 text-orange-700'
                                            : r.sessionStatus === 'completed'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-amber-50 text-amber-700'
                                            }`}>
                                            {r.statusLabel}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-gray-500 max-w-[180px]">
                                        {r.notes ? (
                                            <span className="truncate text-xs">{r.notes}</span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── Guru Per Kelas Tab ──────────────────────────────────
const GuruPerKelas: React.FC<{ start: string; end: string; forceGuruId?: number }> = ({ start, end, forceGuruId }) => {
    const [expanded, setExpanded] = useState<number | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['guru-class', start, end, forceGuruId],
        queryFn: () => apiFetch(`/api/attendance/guru/class?start=${start}&end=${end}${forceGuruId ? `&guruId=${forceGuruId}` : ''}`),
        enabled: !!start && !!end,
    });

    const classes: GuruClassSummary[] = data?.classes || [];

    // Flatten all sessions for export
    const allSessions = useMemo(() => {
        return classes.flatMap((cls) =>
            cls.sessions.map((s) => ({
                ...s,
                className: cls.className,
            }))
        );
    }, [classes]);

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14);
        doc.text('Rekap Kehadiran Guru Per Kelas', 14, 15);
        doc.setFontSize(9);
        doc.text(`Periode: ${start} s/d ${end}`, 14, 22);

        autoTable(doc, {
            startY: 28,
            head: [['Tanggal', 'Jam', 'Kelas', 'Mata Pelajaran', 'Guru', 'Status']],
            body: allSessions.map((s) => [
                format(new Date(s.date), 'dd MMM yyyy', { locale: localeId }),
                s.startTime?.substring(0, 5) || '-',
                s.className,
                s.subject || '-',
                s.teacher || '-',
                s.status === 'present' ? 'Hadir'
                    : s.status === 'late' ? 'Terlambat'
                        : s.status === 'absent' ? 'Absen'
                            : s.status === 'alpha' ? 'Tanpa Keterangan'
                                : s.status === 'sick' ? 'Sakit'
                                    : s.status === 'permission' ? 'Izin'
                                        : 'Tidak ada data',
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] },
        });

        doc.save(`rekap_guru_kelas_${start}_${end}.pdf`);
    };

    return (
        <div className="space-y-3">
            {/* Export Buttons */}
            <div className="flex justify-end gap-2">
                <button
                    onClick={handleExportPDF}
                    disabled={allSessions.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-40"
                >
                    <FileText className="w-3.5 h-3.5" />
                    Cetak PDF
                </button>
                <button
                    onClick={() => apiDownload('/api/attendance/export/guru-class', { start, end }, `rekap_guru_kelas_${start}_${end}.xlsx`)}
                    disabled={allSessions.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition disabled:opacity-40"
                >
                    <Download className="w-3.5 h-3.5" />
                    Export Excel
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
                </div>
            ) : classes.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center text-gray-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p>Tidak ada data sesi kelas dalam rentang ini.</p>
                </div>
            ) : (
                classes.map((cls) => (
                    <div key={cls.classId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <button
                            className="w-full px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 hover:bg-gray-50/50 transition text-left"
                            onClick={() => setExpanded(expanded === cls.classId ? null : cls.classId)}
                        >
                            <div className="flex items-center gap-2 sm:gap-3">
                                {expanded === cls.classId
                                    ? <ChevronDown className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 flex-shrink-0" />
                                    : <ChevronRight className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 flex-shrink-0" />
                                }
                                <span className="font-bold text-gray-900 text-sm sm:text-base">{cls.className}</span>
                                <span className="text-xs sm:text-sm text-gray-500">{cls.totalSessions} sesi</span>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm pl-6 sm:pl-0">
                                <span className="text-emerald-600 font-medium">{cls.attended} <span className="hidden sm:inline">hadir</span></span>
                                <span className="text-red-500 font-medium">{cls.absent} <span className="hidden sm:inline">absen</span></span>
                                <span className={`font-bold ${cls.percentage >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {cls.percentage}%
                                </span>
                            </div>
                        </button>
                        {expanded === cls.classId && (
                            <div className="border-t border-gray-100 overflow-x-auto">
                                <table className="w-full text-sm min-w-[500px]">
                                    <thead>
                                        <tr className="bg-gray-50/80">
                                            <th className="px-5 py-2 text-left font-medium text-gray-500">Tanggal</th>
                                            <th className="px-5 py-2 text-left font-medium text-gray-500">Mapel</th>
                                            <th className="px-5 py-2 text-left font-medium text-gray-500">Guru</th>
                                            <th className="px-5 py-2 text-center font-medium text-gray-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {cls.sessions.map((s, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50">
                                                <td className="px-5 py-2 text-gray-800">
                                                    {format(new Date(s.date), 'dd MMM', { locale: localeId })}
                                                    <span className="text-gray-400 ml-1">{s.startTime?.substring(0, 5)}</span>
                                                </td>
                                                <td className="px-5 py-2 text-gray-700">{s.subject}</td>
                                                <td className="px-5 py-2 text-gray-700">{s.teacher}</td>
                                                <td className="px-5 py-2 text-center"><StatusBadge status={s.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

// ─── Siswa Tab ───────────────────────────────────────────
const SiswaTab: React.FC<{ start: string; end: string }> = ({ start, end }) => {
    const [expandedClass, setExpandedClass] = useState<number | null>(null);
    const [exportingPDF, setExportingPDF] = useState(false);

    const { data: summaryData, isLoading: loadingSummary } = useQuery({
        queryKey: ['siswa-summary', start, end],
        queryFn: () => apiFetch(`/api/attendance/siswa/summary?start=${start}&end=${end}`),
        enabled: !!start && !!end,
    });

    const { data: detailData, isLoading: loadingDetail } = useQuery({
        queryKey: ['siswa-detail', expandedClass, start, end],
        queryFn: () => apiFetch(`/api/attendance/siswa/${expandedClass}/detail?start=${start}&end=${end}`),
        enabled: !!expandedClass && !!start && !!end,
    });

    const classes: SiswaSummary[] = summaryData?.classes || [];
    const students: SiswaDetail[] = detailData?.students || [];

    // ─── PDF Export Handler ──────────────────────────────
    const handleExportPDF = async () => {
        if (classes.length === 0) return;
        setExportingPDF(true);

        try {
            // Fetch detail for ALL classes
            const allClassDetails: { cls: SiswaSummary; students: SiswaDetail[] }[] = [];
            for (const cls of classes) {
                const data = await apiFetch(`/api/attendance/siswa/${cls.classId}/detail?start=${start}&end=${end}`);
                allClassDetails.push({ cls, students: (data?.students || []).sort((a: SiswaDetail, b: SiswaDetail) => a.name.localeCompare(b.name)) });
            }

            const doc = new jsPDF({ orientation: 'landscape' });
            const pageWidth = doc.internal.pageSize.getWidth();

            // ── Header ──
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('Rekap Kehadiran Siswa', pageWidth / 2, 15, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Periode: ${start} s/d ${end}`, pageWidth / 2, 22, { align: 'center' });
            doc.text(`Dicetak: ${format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: localeId })}`, pageWidth / 2, 28, { align: 'center' });

            let startY = 35;

            // ── Per-class tables ──
            for (let i = 0; i < allClassDetails.length; i++) {
                const { cls, students: sList } = allClassDetails[i];

                // Class title
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(`Kelas ${cls.className}  (${cls.totalStudents} siswa, ${cls.totalSessions || 0} sesi)`, 14, startY);
                startY += 3;

                const bodyRows = sList.map((s, idx) => [
                    idx + 1,
                    s.nis || '-',
                    s.name,
                    s.gender === 'M' ? 'L' : 'P',
                    s.present,
                    s.late,
                    s.sick,
                    s.permission,
                    s.absent,
                    `${s.percentage}%`,
                ]);

                // Class subtotal row
                const totalPresent = sList.reduce((sum, s) => sum + s.present, 0);
                const totalLate = sList.reduce((sum, s) => sum + s.late, 0);
                const totalSick = sList.reduce((sum, s) => sum + s.sick, 0);
                const totalPermission = sList.reduce((sum, s) => sum + s.permission, 0);
                const totalAbsent = sList.reduce((sum, s) => sum + s.absent, 0);
                const grandTotal = totalPresent + totalLate + totalSick + totalPermission + totalAbsent;
                const classPct = grandTotal > 0 ? Math.round(((totalPresent + totalLate) / grandTotal) * 100) : 0;

                bodyRows.push([
                    '', '', `Total Kelas ${cls.className}`, '', totalPresent, totalLate, totalSick, totalPermission, totalAbsent, `${classPct}%`,
                ]);

                autoTable(doc, {
                    startY,
                    head: [['No', 'NIS', 'Nama', 'JK', 'Hadir', 'Terlambat', 'Sakit', 'Izin', 'Absen', '%']],
                    body: bodyRows,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
                    columnStyles: {
                        0: { cellWidth: 12, halign: 'center' },
                        1: { cellWidth: 25 },
                        2: { cellWidth: 55 },
                        3: { cellWidth: 12, halign: 'center' },
                        4: { halign: 'center' },
                        5: { halign: 'center' },
                        6: { halign: 'center' },
                        7: { halign: 'center' },
                        8: { halign: 'center' },
                        9: { halign: 'center' },
                    },
                    didParseCell: (data: any) => {
                        // Bold the subtotal row
                        if (data.row.index === bodyRows.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [243, 244, 246];
                        }
                    },
                });

                startY = (doc as any).lastAutoTable.finalY + 10;

                // Add page break if next class won't fit (leave 40mm margin)
                if (i < allClassDetails.length - 1 && startY > doc.internal.pageSize.getHeight() - 40) {
                    doc.addPage();
                    startY = 15;
                }
            }

            // ── Footer: Grand Summary ──
            if (startY > doc.internal.pageSize.getHeight() - 50) {
                doc.addPage();
                startY = 15;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Ringkasan Keseluruhan', 14, startY);
            startY += 3;

            const summaryRows = classes.map(cls => [
                cls.className,
                cls.totalStudents,
                cls.totalSessions || 0,
                cls.present,
                cls.late,
                cls.sick,
                cls.permission,
                cls.absent,
                `${cls.percentage}%`,
            ]);

            autoTable(doc, {
                startY,
                head: [['Kelas', 'Siswa', 'Sesi', 'Hadir', 'Terlambat', 'Sakit', 'Izin', 'Absen', '%']],
                body: summaryRows,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [59, 130, 246], textColor: 255 },
                columnStyles: {
                    1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' },
                    4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' },
                    7: { halign: 'center' }, 8: { halign: 'center' },
                },
            });

            doc.save(`rekap_siswa_${start}_${end}.pdf`);
        } catch (error) {
            console.error('PDF export error:', error);
            alert('Gagal mengekspor PDF. Silakan coba lagi.');
        } finally {
            setExportingPDF(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Export */}
            <div className="flex justify-end gap-2">
                <button
                    onClick={handleExportPDF}
                    disabled={exportingPDF || classes.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {exportingPDF ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    {exportingPDF ? 'Mengekspor...' : 'Export PDF'}
                </button>
                <button
                    onClick={() => apiDownload('/api/attendance/export/siswa-summary', { start, end }, `rekap_siswa_${start}_${end}.xlsx`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                >
                    <Download className="w-3.5 h-3.5" />
                    Export Excel
                </button>
            </div>

            {loadingSummary ? (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
                </div>
            ) : classes.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center text-gray-400">
                    <GraduationCap className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p>Tidak ada data kelas.</p>
                </div>
            ) : (
                classes.map((cls) => (
                    <div key={cls.classId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Class Header */}
                        <button
                            className="w-full px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 hover:bg-gray-50/50 transition text-left"
                            onClick={() => setExpandedClass(expandedClass === cls.classId ? null : cls.classId)}
                        >
                            <div className="flex items-center gap-2 sm:gap-3">
                                {expandedClass === cls.classId
                                    ? <ChevronDown className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 flex-shrink-0" />
                                    : <ChevronRight className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 flex-shrink-0" />
                                }
                                <span className="font-bold text-gray-900 text-sm sm:text-base">Kelas {cls.className}</span>
                                <span className="text-xs sm:text-sm text-gray-500">{cls.totalStudents} siswa • {cls.totalSessions || 0} sesi</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm pl-6 sm:pl-0">
                                <span className="text-emerald-600 font-medium">{cls.present} <span className="hidden sm:inline">hadir</span></span>
                                <span className="text-amber-600 font-medium">{cls.late} <span className="hidden sm:inline">terlambat</span></span>
                                <span className="text-red-500 font-medium">{cls.absent} <span className="hidden sm:inline">absen</span></span>
                                <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${cls.percentage >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {cls.percentage}%
                                </span>
                            </div>
                        </button>

                        {/* Expanded: Student Detail */}
                        {expandedClass === cls.classId && (
                            <div className="border-t border-gray-100">
                                {loadingDetail ? (
                                    <div className="flex items-center justify-center py-10">
                                        <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
                                    </div>
                                ) : students.length === 0 ? (
                                    <p className="text-center py-8 text-gray-400 text-sm">Tidak ada data siswa.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[600px]">
                                            <thead>
                                                <tr className="bg-gray-50/80">
                                                    <th className="px-5 py-2 text-left font-medium text-gray-500">NIS</th>
                                                    <th className="px-5 py-2 text-left font-medium text-gray-500">Nama</th>
                                                    <th className="px-5 py-2 text-center font-medium text-gray-500">JK</th>
                                                    <th className="px-5 py-2 text-center font-medium text-emerald-600">Hadir</th>
                                                    <th className="px-5 py-2 text-center font-medium text-amber-600">Terlambat</th>
                                                    <th className="px-5 py-2 text-center font-medium text-blue-600">Sakit</th>
                                                    <th className="px-5 py-2 text-center font-medium text-purple-600">Izin</th>
                                                    <th className="px-5 py-2 text-center font-medium text-red-600">Absen</th>
                                                    <th className="px-5 py-2 text-center font-medium text-gray-500">%</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {students.map((s) => (
                                                    <tr key={s.studentId} className="hover:bg-gray-50/50">
                                                        <td className="px-5 py-2 text-gray-600 font-mono text-xs">{s.nis}</td>
                                                        <td className="px-5 py-2 text-gray-900 font-medium">{s.name}</td>
                                                        <td className="px-5 py-2 text-center text-gray-500">{s.gender === 'M' ? 'L' : 'P'}</td>
                                                        <td className="px-5 py-2 text-center text-emerald-600 font-medium">{s.present}</td>
                                                        <td className="px-5 py-2 text-center text-amber-600 font-medium">{s.late}</td>
                                                        <td className="px-5 py-2 text-center text-blue-600 font-medium">{s.sick}</td>
                                                        <td className="px-5 py-2 text-center text-purple-600 font-medium">{s.permission}</td>
                                                        <td className="px-5 py-2 text-center text-red-600 font-medium">{s.absent}</td>
                                                        <td className="px-5 py-2 text-center">
                                                            <span className={`font-bold ${s.percentage >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {s.percentage}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

// ─── Main Rekap Component ────────────────────────────────
const Rekap: React.FC = () => {
    const { user } = useAuth();
    const isTeacher = user?.role === 'teacher' || user?.role === 'guru';
    const myTeacherId = user?.teacherId;

    // Default: this week
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: format(subDays(today, 7), 'yyyy-MM-dd'),
        end: format(today, 'yyyy-MM-dd'),
    });
    const [mainTab, setMainTab] = useState<'guru' | 'siswa'>('guru');
    const [guruSubTab, setGuruSubTab] = useState<'reguler' | 'mengajar' | 'kelas'>('reguler');

    // Quick-fetch stats for header cards (teacher: only own data)
    const guruStatsGuruId = isTeacher && myTeacherId ? `&guruId=${myTeacherId}` : '';
    const { data: guruData } = useQuery({
        queryKey: ['guru-regular', dateRange.start, dateRange.end, myTeacherId],
        queryFn: () => apiFetch(`/api/attendance/guru/regular?start=${dateRange.start}&end=${dateRange.end}${guruStatsGuruId}`),
    });
    const { data: siswaData } = useQuery({
        queryKey: ['siswa-summary', dateRange.start, dateRange.end],
        queryFn: () => apiFetch(`/api/attendance/siswa/summary?start=${dateRange.start}&end=${dateRange.end}`),
        enabled: !isTeacher, // Only fetch siswa data for admin
    });

    const guruRows: GuruRegularRow[] = guruData?.rows || [];
    const siswaClasses: SiswaSummary[] = siswaData?.classes || [];

    const guruStats = useMemo(() => {
        const total = guruRows.length;
        const hadir = guruRows.filter((r) => r.status === 'present' || r.status === 'late').length;
        return { total, hadir, pct: total > 0 ? Math.round((hadir / total) * 100) : 0 };
    }, [guruRows]);

    const siswaStats = useMemo(() => {
        const totalStudents = siswaClasses.reduce((s, c) => s + c.totalStudents, 0);
        const totalPresent = siswaClasses.reduce((s, c) => s + c.present + c.late, 0);
        const totalRecords = siswaClasses.reduce((s, c) => s + c.present + c.late + c.absent + c.sick + c.permission, 0);
        return { totalStudents, totalPresent, pct: totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0 };
    }, [siswaClasses]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ClipboardList className="w-7 h-7 text-amber-600" />
                        Rekap Kehadiran
                    </h1>
                    <p className="text-gray-500 mt-1">{isTeacher ? 'Rekap kehadiran Anda' : 'Statistik kehadiran guru dan siswa'}</p>
                </div>

                {/* Date Filter */}
                <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm w-full sm:w-auto">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-1 sm:px-2 py-1 border-0 text-sm focus:outline-none bg-transparent min-w-0 flex-1 sm:flex-none"
                    />
                    <span className="text-gray-300">—</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-1 sm:px-2 py-1 border-0 text-sm focus:outline-none bg-transparent min-w-0 flex-1 sm:flex-none"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className={`grid gap-3 ${isTeacher ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
                <StatCard
                    label={isTeacher ? 'Kehadiran Anda' : 'Kehadiran Guru'}
                    value={`${guruStats.pct}%`}
                    icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                    color="bg-emerald-50"
                />
                <StatCard
                    label="Data Kehadiran"
                    value={guruStats.total}
                    icon={<UserCheck className="w-5 h-5 text-blue-600" />}
                    color="bg-blue-50"
                />
                {!isTeacher && (
                    <>
                        <StatCard
                            label="Kehadiran Siswa"
                            value={`${siswaStats.pct}%`}
                            icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
                            color="bg-purple-50"
                        />
                        <StatCard
                            label="Total Siswa"
                            value={siswaStats.totalStudents}
                            icon={<Users className="w-5 h-5 text-teal-600" />}
                            color="bg-teal-50"
                        />
                    </>
                )}
            </div>

            {/* Main Tabs: Guru | Siswa (Siswa hidden for teacher role) */}
            {!isTeacher ? (
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit">
                    <button
                        onClick={() => setMainTab('guru')}
                        className={`flex items-center justify-center gap-2 flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-lg text-sm font-semibold transition ${mainTab === 'guru'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <UserCheck className="w-4 h-4" />
                        Guru
                    </button>
                    <button
                        onClick={() => setMainTab('siswa')}
                        className={`flex items-center justify-center gap-2 flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-lg text-sm font-semibold transition ${mainTab === 'siswa'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <GraduationCap className="w-4 h-4" />
                        Siswa
                    </button>
                </div>
            ) : null}

            {/* Tab Content */}
            {mainTab === 'guru' && (
                <div className="space-y-4">
                    {/* Sub-tabs */}
                    <div className="flex gap-1 sm:gap-4 border-b border-gray-200 mb-4 px-1 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => setGuruSubTab('reguler')}
                            className={`flex items-center gap-1.5 px-2 sm:px-3 pb-2 text-xs sm:text-sm font-medium transition border-b-2 whitespace-nowrap ${guruSubTab === 'reguler'
                                ? 'border-amber-500 text-amber-700'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <ClipboardList className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Kehadiran</span> Reguler
                        </button>
                        <button
                            onClick={() => setGuruSubTab('mengajar')}
                            className={`flex items-center gap-1.5 px-2 sm:px-3 pb-2 text-xs sm:text-sm font-medium transition border-b-2 whitespace-nowrap ${guruSubTab === 'mengajar'
                                ? 'border-emerald-500 text-emerald-700'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <BookOpen className="w-3.5 h-3.5" />
                            Per Sesi <span className="hidden sm:inline">KBM</span>
                        </button>
                        <button
                            onClick={() => setGuruSubTab('kelas')}
                            className={`flex items-center gap-1.5 px-2 sm:px-3 pb-2 text-xs sm:text-sm font-medium transition border-b-2 whitespace-nowrap ${guruSubTab === 'kelas'
                                ? 'border-blue-500 text-blue-700'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <Users className="w-3.5 h-3.5" />
                            Per Kelas
                        </button>
                    </div>

                    <div className="mt-2">
                        {guruSubTab === 'reguler' && <GuruReguler start={dateRange.start} end={dateRange.end} forceGuruId={isTeacher ? myTeacherId : undefined} />}
                        {guruSubTab === 'mengajar' && <GuruMengajar start={dateRange.start} end={dateRange.end} forceGuruId={isTeacher ? myTeacherId : undefined} />}
                        {guruSubTab === 'kelas' && <GuruPerKelas start={dateRange.start} end={dateRange.end} forceGuruId={isTeacher ? myTeacherId : undefined} />}
                    </div>
                </div>
            )}

            {mainTab === 'siswa' && (
                <SiswaTab start={dateRange.start} end={dateRange.end} />
            )}
        </div>
    );
};

export default Rekap;
