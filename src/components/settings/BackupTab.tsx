import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Database, Download, Loader2, HardDrive, CheckCircle,
    Users, BookOpen, Calendar, Clock, MapPin, Shield, FileText,
    GraduationCap, ClipboardList, AlertTriangle, Upload,
    ShieldAlert, X, ArrowUpFromLine,
} from 'lucide-react';
import api from '../../lib/api';

interface TableInfo {
    name: string;
    key: string;
    count: number;
}

interface RestorePreview {
    metadata: {
        version: string;
        exportedAt: string;
        exportedBy: string;
        tables: Record<string, number>;
        totalRecords: number;
    };
    data: Record<string, any[]>;
}

const TABLE_ICONS: Record<string, React.ReactNode> = {
    users: <Users className="w-4 h-4" />,
    teachers: <GraduationCap className="w-4 h-4" />,
    classes: <BookOpen className="w-4 h-4" />,
    students: <Users className="w-4 h-4" />,
    subjects: <BookOpen className="w-4 h-4" />,
    schedules: <Calendar className="w-4 h-4" />,
    sessions: <ClipboardList className="w-4 h-4" />,
    teacherAttendance: <Clock className="w-4 h-4" />,
    studentAttendance: <Clock className="w-4 h-4" />,
    activityLogs: <FileText className="w-4 h-4" />,
    timeSlots: <Clock className="w-4 h-4" />,
    holidayEvents: <Calendar className="w-4 h-4" />,
    teacherWorkingHours: <Clock className="w-4 h-4" />,
    geofences: <MapPin className="w-4 h-4" />,
};

const TABLE_LABELS: Record<string, string> = {
    users: 'Users',
    teachers: 'Teachers',
    classes: 'Classes',
    students: 'Students',
    subjects: 'Subjects',
    schedules: 'Schedules',
    sessions: 'Sessions',
    teacherAttendance: 'Teacher Attendance',
    studentAttendance: 'Student Attendance',
    activityLogs: 'Activity Logs',
    timeSlots: 'Time Slots',
    holidayEvents: 'Holiday Events',
    teacherWorkingHours: 'Working Hours',
    geofences: 'Geofences',
};

const BackupTab: React.FC = () => {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Backup states
    const [downloading, setDownloading] = useState(false);
    const [downloadSuccess, setDownloadSuccess] = useState(false);

    // Restore states
    const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [restoreConfirmText, setRestoreConfirmText] = useState('');
    const [restoring, setRestoring] = useState(false);
    const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
    const [restoreError, setRestoreError] = useState<string | null>(null);

    const { data: backupInfo, isLoading } = useQuery({
        queryKey: ['backup-info'],
        queryFn: async () => {
            const res = await api.get('/admin/backup/info');
            return res.data as { tables: TableInfo[]; totalRecords: number };
        },
    });

    const handleDownloadBackup = async () => {
        setDownloading(true);
        setDownloadSuccess(false);
        try {
            const res = await api.get('/admin/backup', { responseType: 'blob' });
            const disposition = res.headers['content-disposition'];
            let filename = 'backup_presensi.json';
            if (disposition) {
                const match = disposition.match(/filename="?([^"]+)"?/);
                if (match) filename = match[1];
            }
            const blob = new Blob([res.data], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setDownloadSuccess(true);
            setTimeout(() => setDownloadSuccess(false), 5000);
        } catch (err) {
            console.error('Backup download failed:', err);
            alert('Gagal mendownload backup. Silakan coba lagi.');
        } finally {
            setDownloading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            setRestoreError('File harus berformat .json');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (!parsed.metadata || !parsed.data) {
                    setRestoreError('Format file backup tidak valid. Pastikan file berasal dari fitur Backup.');
                    return;
                }
                setRestorePreview(parsed);
                setRestoreError(null);
                setRestoreResult(null);
            } catch {
                setRestoreError('File JSON tidak valid atau rusak.');
            }
        };
        reader.readAsText(file);

        // Reset the input so the same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRestore = async () => {
        if (!restorePreview || restoreConfirmText !== 'RESTORE DATA') return;

        setRestoring(true);
        setRestoreError(null);
        setRestoreResult(null);
        try {
            const payload = { ...restorePreview, confirmText: restoreConfirmText };
            const res = await api.post('/admin/restore', payload);
            setRestoreResult({ success: true, message: res.data.message });
            setShowRestoreConfirm(false);
            setRestoreConfirmText('');
            setRestorePreview(null);
            // Refresh backup info to show updated counts
            queryClient.invalidateQueries({ queryKey: ['backup-info'] });
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.detail || 'Restore gagal. Silakan coba lagi.';
            setRestoreError(msg);
            setShowRestoreConfirm(false);
            setRestoreConfirmText('');
        } finally {
            setRestoring(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Database className="w-5 h-5 text-emerald-600" />
                        Backup & Import Data
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Download backup atau import data dari file backup
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 border-2 border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 transition-all text-sm font-medium"
                    >
                        <Upload className="w-4 h-4" />
                        Import Data
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <button
                        onClick={handleDownloadBackup}
                        disabled={downloading || isLoading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {downloading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Memproses...
                            </>
                        ) : downloadSuccess ? (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Berhasil!
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Download Backup
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Success / Error messages */}
            {downloadSuccess && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-emerald-800">Backup berhasil didownload!</p>
                        <p className="text-xs text-emerald-600 mt-0.5">Simpan file backup di tempat yang aman.</p>
                    </div>
                </div>
            )}

            {restoreResult?.success && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-emerald-800">{restoreResult.message}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">Data telah berhasil diimport dari file backup.</p>
                    </div>
                </div>
            )}

            {restoreError && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-red-800">Error</p>
                        <p className="text-xs text-red-600 mt-0.5">{restoreError}</p>
                    </div>
                </div>
            )}

            {/* ─── Import Preview Card ─── */}
            {restorePreview && (
                <div className="border-2 border-blue-300 bg-blue-50/30 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                                <ArrowUpFromLine className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">File Backup Siap Diimport</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Backup dari: {new Date(restorePreview.metadata.exportedAt).toLocaleString('id-ID')}
                                    {' · '}oleh {restorePreview.metadata.exportedBy}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setRestorePreview(null); setRestoreError(null); }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Preview table counts */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {Object.entries(restorePreview.metadata.tables).map(([key, count]) => (
                            <div key={key} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
                                <span className="text-gray-400">
                                    {TABLE_ICONS[key] || <Database className="w-3.5 h-3.5" />}
                                </span>
                                <span className="text-xs text-gray-600 truncate">{TABLE_LABELS[key] || key}</span>
                                <span className="text-xs font-bold text-blue-600 ml-auto">{(count as number).toLocaleString('id-ID')}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                        <p className="text-sm font-medium text-gray-700">
                            Total: <span className="text-blue-700 font-bold">{restorePreview.metadata.totalRecords.toLocaleString('id-ID')}</span> record
                        </p>
                        <button
                            onClick={() => setShowRestoreConfirm(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all text-sm font-medium shadow-sm"
                        >
                            <ArrowUpFromLine className="w-4 h-4" />
                            Import Data Ini
                        </button>
                    </div>
                </div>
            )}

            {/* Stats card */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                        <HardDrive className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-emerald-800">Data Saat Ini</p>
                        <p className="text-2xl font-bold text-emerald-900">
                            {isLoading ? '...' : backupInfo?.totalRecords.toLocaleString('id-ID') ?? 0}
                        </p>
                    </div>
                </div>
                <p className="text-xs text-emerald-700">
                    <Shield className="w-3.5 h-3.5 inline mr-1" />
                    Backup mencakup {backupInfo?.tables.length ?? 14} tabel data
                </p>
            </div>

            {/* Table breakdown */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Rincian Tabel</h3>
                {isLoading ? (
                    <div className="text-center py-8">
                        <Loader2 className="w-6 h-6 mx-auto animate-spin text-emerald-500" />
                        <p className="text-gray-500 text-sm mt-2">Memuat info...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {backupInfo?.tables.map((table) => (
                            <div
                                key={table.key}
                                className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                                        {TABLE_ICONS[table.key] || <Database className="w-4 h-4" />}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">{table.name}</span>
                                </div>
                                <span className={`text-sm font-bold ${table.count > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {table.count.toLocaleString('id-ID')}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                    <p className="font-medium">Catatan Backup & Import</p>
                    <ul className="mt-1 space-y-1 list-disc pl-4">
                        <li>File backup berformat JSON dan dapat dibuka di text editor</li>
                        <li>Backup mencakup <strong>semua data</strong> termasuk user, guru, siswa, kehadiran, jadwal, dll</li>
                        <li><strong>Import akan menghapus</strong> seluruh data yang ada dan menggantinya dengan data dari file backup</li>
                        <li>Disarankan backup terlebih dahulu sebelum import data</li>
                        <li>Jika import gagal, semua perubahan otomatis dibatalkan (rollback)</li>
                    </ul>
                </div>
            </div>

            {/* ─── Restore Confirm Modal ─── */}
            {showRestoreConfirm && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowRestoreConfirm(false); setRestoreConfirmText(''); }}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-blue-600 px-6 py-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5" /> Konfirmasi Import Data
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <p className="text-amber-800 font-medium">⚠️ PERHATIAN</p>
                                <p className="text-amber-700 text-sm mt-2">
                                    Import data akan <strong>menghapus semua data yang ada</strong> dan menggantinya
                                    dengan data dari file backup ({restorePreview?.metadata.totalRecords.toLocaleString('id-ID')} record).
                                </p>
                                <p className="text-amber-700 text-sm mt-1">
                                    Backup dari: <strong>{restorePreview && new Date(restorePreview.metadata.exportedAt).toLocaleString('id-ID')}</strong>
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Ketik <span className="font-bold text-blue-600">RESTORE DATA</span> untuk konfirmasi:
                                </label>
                                <input
                                    type="text"
                                    value={restoreConfirmText}
                                    onChange={(e) => setRestoreConfirmText(e.target.value)}
                                    placeholder="RESTORE DATA"
                                    className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl text-center font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowRestoreConfirm(false); setRestoreConfirmText(''); }}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleRestore}
                                    disabled={restoreConfirmText !== 'RESTORE DATA' || restoring}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {restoring && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Import Sekarang
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BackupTab;
