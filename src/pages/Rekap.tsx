import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
    ClipboardList, Users, UserCheck, Calendar, Download,
    ChevronDown, ChevronRight, BookOpen, TrendingUp,
    RefreshCw, GraduationCap, FileText,
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
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
            <div className={`p-3 rounded-xl ${color}`}>
                {icon}
            </div>
        </div>
    </div>
);

// ─── Guru Reguler Tab ────────────────────────────────────
const GuruReguler: React.FC<{ start: string; end: string }> = ({ start, end }) => {
    const [selectedGuruId, setSelectedGuruId] = useState<string>('');

    const { data, isLoading } = useQuery({
        queryKey: ['guru-regular', start, end, selectedGuruId],
        queryFn: () => apiFetch(`/api/attendance/guru/regular?start=${start}&end=${end}${selectedGuruId ? `&guruId=${selectedGuruId}` : ''}`),
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
            <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-amber-500" />
                        Kehadiran Reguler — {rows.length} data
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Guru filter dropdown */}
                        <select
                            value={selectedGuruId}
                            onChange={(e) => setSelectedGuruId(e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                        >
                            <option value="">Semua Guru</option>
                            {teachers.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>

                        {/* PDF Export */}
                        <button
                            onClick={handleExportPDF}
                            disabled={rows.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-40"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Cetak PDF
                        </button>

                        {/* Excel Export */}
                        <button
                            onClick={() => apiDownload('/api/attendance/export/guru-regular', { start, end }, `rekap_guru_${start}_${end}.xlsx`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export Excel
                        </button>
                    </div>
                </div>
            </div>
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
                    <table className="w-full text-sm">
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
                                    <td className="px-5 py-3 text-gray-500 truncate max-w-[200px]">{r.notes || '-'}</td>
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
const GuruMengajar: React.FC<{ start: string; end: string }> = ({ start, end }) => {
    const [selectedGuruId, setSelectedGuruId] = useState<string>('');

    const { data, isLoading } = useQuery({
        queryKey: ['guru-mengajar', start, end, selectedGuruId],
        queryFn: () => apiFetch(`/api/attendance/guru/mengajar?start=${start}&end=${end}${selectedGuruId ? `&guruId=${selectedGuruId}` : ''}`),
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
            <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-500" />
                        Kehadiran Mengajar (KBM) — {rows.length} sesi
                        <span className="text-xs text-gray-400 font-normal ml-2">
                            Source: sessions table
                        </span>
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Guru filter dropdown */}
                        <select
                            value={selectedGuruId}
                            onChange={(e) => setSelectedGuruId(e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none"
                        >
                            <option value="">Semua Guru</option>
                            {teachers.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>

                        {/* PDF Export */}
                        <button
                            onClick={handleExportPDF}
                            disabled={rows.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-40"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Cetak PDF
                        </button>
                    </div>
                </div>
            </div>
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
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50/80">
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Tanggal</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Guru</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Kelas</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-600">Mapel</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Masuk</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Keluar</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Durasi</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-600">Status</th>
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
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.sessionStatus === 'completed'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-amber-50 text-amber-700'
                                            }`}>
                                            {r.statusLabel}
                                        </span>
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
const GuruPerKelas: React.FC<{ start: string; end: string }> = ({ start, end }) => {
    const [expanded, setExpanded] = useState<number | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['guru-class', start, end],
        queryFn: () => apiFetch(`/api/attendance/guru/class?start=${start}&end=${end}`),
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
                            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition"
                            onClick={() => setExpanded(expanded === cls.classId ? null : cls.classId)}
                        >
                            <div className="flex items-center gap-3">
                                {expanded === cls.classId
                                    ? <ChevronDown className="w-5 h-5 text-gray-400" />
                                    : <ChevronRight className="w-5 h-5 text-gray-400" />
                                }
                                <span className="font-bold text-gray-900">{cls.className}</span>
                                <span className="text-sm text-gray-500">{cls.totalSessions} sesi</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                                <span className="text-emerald-600 font-medium">{cls.attended} hadir</span>
                                <span className="text-red-500 font-medium">{cls.absent} absen</span>
                                <span className={`font-bold ${cls.percentage >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {cls.percentage}%
                                </span>
                            </div>
                        </button>
                        {expanded === cls.classId && (
                            <div className="border-t border-gray-100 overflow-x-auto">
                                <table className="w-full text-sm">
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

    return (
        <div className="space-y-3">
            {/* Export */}
            <div className="flex justify-end">
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
                            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition"
                            onClick={() => setExpandedClass(expandedClass === cls.classId ? null : cls.classId)}
                        >
                            <div className="flex items-center gap-3">
                                {expandedClass === cls.classId
                                    ? <ChevronDown className="w-5 h-5 text-gray-400" />
                                    : <ChevronRight className="w-5 h-5 text-gray-400" />
                                }
                                <span className="font-bold text-gray-900">Kelas {cls.className}</span>
                                <span className="text-sm text-gray-500">{cls.totalStudents} siswa • {cls.totalSessions || 0} sesi</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
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
                                        <table className="w-full text-sm">
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
    // Default: this week
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: format(subDays(today, 7), 'yyyy-MM-dd'),
        end: format(today, 'yyyy-MM-dd'),
    });
    const [mainTab, setMainTab] = useState<'guru' | 'siswa'>('guru');
    const [guruSubTab, setGuruSubTab] = useState<'reguler' | 'mengajar' | 'kelas'>('reguler');

    // Quick-fetch stats for header cards
    const { data: guruData } = useQuery({
        queryKey: ['guru-regular', dateRange.start, dateRange.end],
        queryFn: () => apiFetch(`/api/attendance/guru/regular?start=${dateRange.start}&end=${dateRange.end}`),
    });
    const { data: siswaData } = useQuery({
        queryKey: ['siswa-summary', dateRange.start, dateRange.end],
        queryFn: () => apiFetch(`/api/attendance/siswa/summary?start=${dateRange.start}&end=${dateRange.end}`),
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
                    <p className="text-gray-500 mt-1">Statistik kehadiran guru dan siswa</p>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-2 py-1 border-0 text-sm focus:outline-none bg-transparent"
                    />
                    <span className="text-gray-300">—</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-2 py-1 border-0 text-sm focus:outline-none bg-transparent"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    label="Kehadiran Guru"
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
            </div>

            {/* Main Tabs: Guru | Siswa */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setMainTab('guru')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${mainTab === 'guru'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <UserCheck className="w-4 h-4" />
                    Guru
                </button>
                <button
                    onClick={() => setMainTab('siswa')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${mainTab === 'siswa'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <GraduationCap className="w-4 h-4" />
                    Siswa
                </button>
            </div>

            {/* Tab Content */}
            {mainTab === 'guru' && (
                <div className="space-y-4">
                    {/* Sub-tabs */}
                    {/* Sub-tabs */}
                    <div className="flex gap-4 border-b border-gray-200 mb-4 px-1">
                        <button
                            onClick={() => setGuruSubTab('reguler')}
                            className={`px-3 pb-2 text-sm font-medium transition border-b-2 ${guruSubTab === 'reguler'
                                ? 'border-amber-500 text-amber-700'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Reguler (Briefing)
                        </button>
                        <button
                            onClick={() => setGuruSubTab('mengajar')}
                            className={`px-3 pb-2 text-sm font-medium transition border-b-2 ${guruSubTab === 'mengajar'
                                ? 'border-emerald-500 text-emerald-700'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Mengajar (KBM)
                        </button>
                        <button
                            onClick={() => setGuruSubTab('kelas')}
                            className={`px-3 pb-2 text-sm font-medium transition border-b-2 ${guruSubTab === 'kelas'
                                ? 'border-blue-500 text-blue-700'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Per Kelas
                        </button>
                    </div>

                    <div className="mt-2">
                        {guruSubTab === 'reguler' && <GuruReguler start={dateRange.start} end={dateRange.end} />}
                        {guruSubTab === 'mengajar' && <GuruMengajar start={dateRange.start} end={dateRange.end} />}
                        {guruSubTab === 'kelas' && <GuruPerKelas start={dateRange.start} end={dateRange.end} />}
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
