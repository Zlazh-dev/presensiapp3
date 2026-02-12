import React, { useState, useRef } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, Calendar, FileText, AlertTriangle, Upload, Paperclip, Trash2 } from 'lucide-react';
import { useIzinSubmit } from '../../hooks/useIzinSubmit';

interface IzinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

type IzinType = 'sick' | 'permission';

interface FormState {
    type: IzinType;
    date: string;
    reason: string;
    assignmentText: string;
}

interface FormErrors {
    date?: string;
    reason?: string;
    assignment?: string;
}

export const IzinModal: React.FC<IzinModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const today = new Date().toISOString().split('T')[0];

    const [form, setForm] = useState<FormState>({
        type: 'sick',
        date: today,
        reason: '',
        assignmentText: '',
    });
    const [file, setFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { mutate: submitLeave, isPending } = useIzinSubmit(() => {
        onSuccess?.();
    });

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
                onSuccess: (data) => {
                    setSubmitResult({ success: true, message: data.message || 'Pengajuan berhasil!' });
                    setTimeout(() => {
                        setForm({ type: 'sick', date: today, reason: '', assignmentText: '' });
                        setFile(null);
                        setSubmitResult(null);
                        onClose();
                    }, 1500);
                },
                onError: (error: any) => {
                    const msg = error.response?.data?.error || error.message || 'Gagal mengajukan izin';
                    setSubmitResult({ success: false, message: msg });
                },
            }
        );
    };

    const handleClose = () => {
        if (isPending) return;
        setForm({ type: 'sick', date: today, reason: '', assignmentText: '' });
        setFile(null);
        setErrors({});
        setSubmitResult(null);
        onClose();
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-900">📝 Ajukan Izin/Sakit</h3>
                    <button
                        onClick={handleClose}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body — scrollable */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Submit Result Alert */}
                    {submitResult && (
                        <div className={`flex items-start gap-3 p-3 rounded-xl ${submitResult.success
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-red-50 border border-red-200'
                            }`}>
                            {submitResult.success ? (
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            )}
                            <p className={`text-sm font-medium ${submitResult.success ? 'text-green-700' : 'text-red-700'
                                }`}>
                                {submitResult.message}
                            </p>
                        </div>
                    )}

                    {/* Type Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Jenis Pengajuan
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, type: 'sick' }))}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${form.type === 'sick'
                                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <AlertTriangle className={`w-4 h-4 ${form.type === 'sick' ? 'text-amber-500' : ''}`} />
                                <span className="font-medium text-sm">Sakit</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, type: 'permission' }))}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${form.type === 'permission'
                                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <FileText className={`w-4 h-4 ${form.type === 'permission' ? 'text-blue-500' : ''}`} />
                                <span className="font-medium text-sm">Izin</span>
                            </button>
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar className="w-4 h-4 inline mr-1.5 text-gray-400" />
                            Tanggal
                        </label>
                        <input
                            type="date"
                            value={form.date}
                            onChange={(e) => {
                                setForm(f => ({ ...f, date: e.target.value }));
                                if (errors.date) setErrors(err => ({ ...err, date: undefined }));
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm transition-colors ${errors.date
                                ? 'border-red-300 focus:border-red-400'
                                : 'border-gray-200 focus:border-blue-400'
                                } focus:outline-none focus:ring-0`}
                        />
                        {errors.date && (
                            <p className="text-xs text-red-500 mt-1.5">{errors.date}</p>
                        )}
                    </div>

                    {/* Reason — MANDATORY */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FileText className="w-4 h-4 inline mr-1.5 text-gray-400" />
                            Alasan <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            value={form.reason}
                            onChange={(e) => {
                                setForm(f => ({ ...f, reason: e.target.value }));
                                if (errors.reason) setErrors(err => ({ ...err, reason: undefined }));
                            }}
                            placeholder={form.type === 'sick' ? 'Contoh: Demam, perlu istirahat...' : 'Contoh: Keperluan keluarga...'}
                            rows={2}
                            maxLength={500}
                            className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm transition-colors resize-none ${errors.reason
                                ? 'border-red-300 focus:border-red-400'
                                : 'border-gray-200 focus:border-blue-400'
                                } focus:outline-none focus:ring-0`}
                        />
                        {errors.reason && (
                            <p className="text-xs text-red-500 mt-1.5">{errors.reason}</p>
                        )}
                    </div>

                    {/* ═══ ASSIGNMENT SECTION ═══ */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">
                                📚 Tugas untuk Siswa <span className="text-red-400">*</span>
                            </span>
                            <span className="text-xs text-gray-400">(file ATAU teks)</span>
                        </div>

                        {/* File Upload Area */}
                        <div
                            className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer ${dragActive
                                    ? 'border-blue-400 bg-blue-50'
                                    : file
                                        ? 'border-green-300 bg-green-50/50'
                                        : errors.assignment
                                            ? 'border-red-300 bg-red-50/30'
                                            : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
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
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                                        <Paperclip className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-5 px-4">
                                    <Upload className={`w-7 h-7 ${dragActive ? 'text-blue-500' : 'text-gray-300'}`} />
                                    <div className="text-center">
                                        <p className="text-sm text-gray-500">
                                            <span className="font-medium text-blue-500">Klik untuk upload</span> atau drag & drop
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX, JPG, PNG (max 10 MB)</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Separator */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 border-t border-gray-200" />
                            <span className="text-xs text-gray-400 font-medium">ATAU</span>
                            <div className="flex-1 border-t border-gray-200" />
                        </div>

                        {/* Assignment Text */}
                        <textarea
                            value={form.assignmentText}
                            onChange={(e) => {
                                setForm(f => ({ ...f, assignmentText: e.target.value }));
                                if (errors.assignment) setErrors(err => ({ ...err, assignment: undefined }));
                            }}
                            placeholder="Ketik tugas untuk siswa di sini... Contoh: Kerjakan halaman 45 soal 1-10"
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm transition-colors resize-none focus:border-blue-400 focus:outline-none focus:ring-0"
                        />

                        {errors.assignment && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors.assignment}
                            </p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Mengirim...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Ajukan {form.type === 'sick' ? 'Sakit' : 'Izin'}
                            </>
                        )}
                    </button>
                </form>

                {/* Footer hint */}
                <div className="px-6 pb-4 flex-shrink-0">
                    <p className="text-xs text-gray-400 text-center">
                        Pengajuan akan dicatat sebagai rekap kehadiran. Jika sudah check-in, akan otomatis di-checkout.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default IzinModal;
