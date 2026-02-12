import React, { useState, useRef } from 'react';
import {
    AlertCircle, CheckCircle, Calendar, FileText, AlertTriangle,
    Upload, Paperclip, Trash2, Loader2, Info
} from 'lucide-react';
import { useIzinSubmit } from '../../hooks/useIzinSubmit';
import LeaveHistory from '../../components/guru/LeaveHistory';

interface FormState {
    type: 'sick' | 'permission';
    date: string;
    reason: string;
    assignmentText: string;
}

interface FormErrors {
    date?: string;
    reason?: string;
    assignment?: string;
}

const IzinSakitPage: React.FC = () => {
    const today = new Date().toISOString().split('T')[0];

    const [form, setForm] = useState<FormState>({
        type: 'sick',
        date: today,
        reason: '',
        assignmentText: '',
    });
    const [file, setFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitResult, setSubmitResult] = useState<{
        success: boolean;
        message: string;
        impactedSessions?: number;
        autoCheckedOut?: boolean;
    } | null>(null);

    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { mutate: submitLeave, isPending } = useIzinSubmit();

    const validate = (): boolean => {
        const newErrors: FormErrors = {};

        if (!form.date) {
            newErrors.date = 'Tanggal wajib diisi';
        }

        if (!form.reason.trim()) {
            newErrors.reason = 'Alasan wajib diisi';
        } else if (form.reason.trim().length < 5) {
            newErrors.reason = 'Alasan minimal 5 karakter';
        }

        // Must have at least file OR assignmentText
        if (!file && !form.assignmentText.trim()) {
            newErrors.assignment = 'Wajib menyertakan tugas: upload file ATAU ketik tugas untuk siswa';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitResult(null);

        if (!validate()) return;

        submitLeave(
            {
                type: form.type,
                date: form.date,
                reason: form.reason.trim(),
                assignmentText: form.assignmentText.trim() || undefined,
                file: file || undefined,
            },
            {
                onSuccess: (data: any) => {
                    setSubmitResult({
                        success: true,
                        message: data.message || 'Pengajuan berhasil!',
                        impactedSessions: data.impactedSessions,
                        autoCheckedOut: data.autoCheckedOut
                    });

                    // Reset form after success
                    setTimeout(() => {
                        setForm({ type: 'sick', date: today, reason: '', assignmentText: '' });
                        setFile(null);
                        // Don't clear result immediately so user can read it
                    }, 500);
                },
                onError: (error: any) => {
                    const msg = error.response?.data?.error || error.message || 'Gagal mengajukan izin';
                    setSubmitResult({ success: false, message: msg });
                },
            }
        );
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) validateAndSetFile(droppedFile);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) validateAndSetFile(selectedFile);
    };

    const validateAndSetFile = (f: File) => {
        const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        if (!allowed.includes(ext)) {
            setErrors(prev => ({ ...prev, assignment: 'Format file tidak didukung. Gunakan PDF, DOC, DOCX, JPG, atau PNG.' }));
            return;
        }
        if (f.size > 10 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, assignment: 'Ukuran file maksimal 10 MB' }));
            return;
        }
        setFile(f);
        setErrors(prev => ({ ...prev, assignment: undefined }));
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Pengajuan Izin / Sakit</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Ajukan permohonan ketidakhadiran dan kelola tugas untuk siswa.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-500" />
                                Form Pengajuan
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Submit Result Alert */}
                            {submitResult && (
                                <div className={`p-4 rounded-xl border ${submitResult.success
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-red-50 border-red-200'
                                    }`}>
                                    <div className="flex items-start gap-3">
                                        {submitResult.success ? (
                                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <h3 className={`text-sm font-semibold ${submitResult.success ? 'text-green-800' : 'text-red-800'
                                                }`}>
                                                {submitResult.success ? 'Berhasil Dikirim' : 'Gagal Mengirim'}
                                            </h3>
                                            <p className={`text-sm mt-1 ${submitResult.success ? 'text-green-700' : 'text-red-700'}`}>
                                                {submitResult.message}
                                            </p>
                                            {submitResult.impactedSessions !== undefined && submitResult.impactedSessions > 0 && (
                                                <div className="mt-2 text-sm bg-white/50 p-2 rounded-lg text-green-800 border border-green-200/50 inline-block">
                                                    ⚠️ {submitResult.impactedSessions} sesi KBM hari ini telah ditandai kosong (butuh pengganti).
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Type Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, type: 'sick' }))}
                                    className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${form.type === 'sick'
                                        ? 'border-amber-400 bg-amber-50 text-amber-900'
                                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <AlertTriangle className={`w-6 h-6 ${form.type === 'sick' ? 'text-amber-500' : 'text-gray-400'}`} />
                                    <span className="font-semibold">Sakit</span>
                                    {form.type === 'sick' && (
                                        <div className="absolute top-3 right-3 text-amber-500">
                                            <CheckCircle className="w-5 h-5 fill-current text-amber-100" />
                                        </div>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, type: 'permission' }))}
                                    className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${form.type === 'permission'
                                        ? 'border-blue-400 bg-blue-50 text-blue-900'
                                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <FileText className={`w-6 h-6 ${form.type === 'permission' ? 'text-blue-500' : 'text-gray-400'}`} />
                                    <span className="font-semibold">Izin</span>
                                    {form.type === 'permission' && (
                                        <div className="absolute top-3 right-3 text-blue-500">
                                            <CheckCircle className="w-5 h-5 fill-current text-blue-100" />
                                        </div>
                                    )}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Tanggal
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={(e) => {
                                                setForm(f => ({ ...f, date: e.target.value }));
                                                if (errors.date) setErrors(err => ({ ...err, date: undefined }));
                                            }}
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border-2 text-sm transition-colors ${errors.date
                                                ? 'border-red-300 focus:border-red-400'
                                                : 'border-gray-200 focus:border-blue-400'
                                                } focus:outline-none focus:ring-0`}
                                        />
                                    </div>
                                    {errors.date && (
                                        <p className="text-xs text-red-500 mt-1.5">{errors.date}</p>
                                    )}
                                </div>

                                {/* Reason */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Alasan <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={form.reason}
                                        onChange={(e) => {
                                            setForm(f => ({ ...f, reason: e.target.value }));
                                            if (errors.reason) setErrors(err => ({ ...err, reason: undefined }));
                                        }}
                                        placeholder={form.type === 'sick' ? 'Sebutkan sakit yang diderita...' : 'Jelaskan keperluan izin...'}
                                        rows={2}
                                        className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm transition-colors resize-none ${errors.reason
                                            ? 'border-red-300 focus:border-red-400'
                                            : 'border-gray-200 focus:border-blue-400'
                                            } focus:outline-none focus:ring-0`}
                                    />
                                    {errors.reason && (
                                        <p className="text-xs text-red-500 mt-1.5">{errors.reason}</p>
                                    )}
                                </div>
                            </div>

                            {/* Assignment Section */}
                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-sm font-semibold text-gray-900 bg-blue-50 px-2 py-1 rounded text-blue-700">
                                        Wajib
                                    </span>
                                    <span className="text-sm font-medium text-gray-700">
                                        Tugas untuk Siswa (Upload File / Teks)
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    {/* File Upload */}
                                    <div
                                        className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer p-6 ${dragActive
                                            ? 'border-blue-400 bg-blue-50'
                                            : file
                                                ? 'border-green-400 bg-green-50'
                                                : errors.assignment
                                                    ? 'border-red-300 bg-red-50/30'
                                                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                            }`}
                                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                        onDragLeave={() => setDragActive(false)}
                                        onDrop={handleFileDrop}
                                        onClick={() => !file && fileInputRef.current?.click()}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />

                                        {file ? (
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0 text-green-600">
                                                    <Paperclip className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                                                    <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                                                    title="Hapus file"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3 text-blue-500">
                                                    <Upload className="w-6 h-6" />
                                                </div>
                                                <p className="text-sm font-medium text-gray-700">
                                                    Klik untuk upload atau drag & drop
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    PDF, DOC, JPG, PNG (Max 10MB)
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <div className="relative flex items-center py-2">
                                        <div className="flex-grow border-t border-gray-200"></div>
                                        <span className="flex-shrink-0 mx-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Atau ketik tugas</span>
                                        <div className="flex-grow border-t border-gray-200"></div>
                                    </div>

                                    {/* Text Area */}
                                    <textarea
                                        value={form.assignmentText}
                                        onChange={(e) => {
                                            setForm(f => ({ ...f, assignmentText: e.target.value }));
                                            if (errors.assignment) setErrors(err => ({ ...err, assignment: undefined }));
                                        }}
                                        placeholder="Ketik instruksi tugas secara detail di sini jika tidak mengupload file..."
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm transition-colors resize-none focus:border-blue-400 focus:outline-none focus:ring-0"
                                    />

                                    {errors.assignment && (
                                        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">
                                            <AlertCircle className="w-4 h-4" />
                                            {errors.assignment}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-4 flex items-center justify-end gap-3">
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sedang Mengirim...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Kirim Pengajuan
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Info Card */}
                    <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                        <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="text-sm text-blue-800 space-y-1">
                            <p className="font-semibold">Catatan Penting:</p>
                            <ul className="list-disc list-inside space-y-0.5 ml-1">
                                <li>Pengajuan izin akan otomatis menutup sesi check-in Anda hari ini.</li>
                                <li>Semua jawal mengajar yang tersisa akan ditandai sebagai "Kosong" dan muncul di daftar Guru Pengganti.</li>
                                <li>Pastikan tugas yang diberikan jelas agar kelas tetap kondusif.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Right Column: History */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6">
                        <LeaveHistory />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IzinSakitPage;
