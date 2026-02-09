import React, { useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, Calendar, FileText, AlertTriangle } from 'lucide-react';
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
}

export const IzinModal: React.FC<IzinModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const today = new Date().toISOString().split('T')[0];

    const [form, setForm] = useState<FormState>({
        type: 'sick',
        date: today,
        reason: '',
    });
    const [errors, setErrors] = useState<Partial<FormState>>({});
    const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

    const { mutate: submitLeave, isPending } = useIzinSubmit(() => {
        onSuccess?.();
    });

    const validate = (): boolean => {
        const newErrors: Partial<FormState> = {};

        if (!form.date) {
            newErrors.date = 'Tanggal wajib diisi';
        }

        if (!form.reason.trim()) {
            newErrors.reason = 'Alasan wajib diisi';
        } else if (form.reason.trim().length < 5) {
            newErrors.reason = 'Alasan minimal 5 karakter';
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
            },
            {
                onSuccess: (data) => {
                    setSubmitResult({ success: true, message: data.message || 'Pengajuan berhasil!' });
                    // Reset form after short delay then close
                    setTimeout(() => {
                        setForm({ type: 'sick', date: today, reason: '' });
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
        setForm({ type: 'sick', date: today, reason: '' });
        setErrors({});
        setSubmitResult(null);
        onClose();
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
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">📝 Ajukan Izin/Sakit</h3>
                    <button
                        onClick={handleClose}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FileText className="w-4 h-4 inline mr-1.5 text-gray-400" />
                            Alasan
                        </label>
                        <textarea
                            value={form.reason}
                            onChange={(e) => {
                                setForm(f => ({ ...f, reason: e.target.value }));
                                if (errors.reason) setErrors(err => ({ ...err, reason: undefined }));
                            }}
                            placeholder={form.type === 'sick' ? 'Contoh: Demam, perlu istirahat...' : 'Contoh: Keperluan keluarga...'}
                            rows={3}
                            className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm transition-colors resize-none ${errors.reason
                                    ? 'border-red-300 focus:border-red-400'
                                    : 'border-gray-200 focus:border-blue-400'
                                } focus:outline-none focus:ring-0`}
                        />
                        {errors.reason && (
                            <p className="text-xs text-red-500 mt-1.5">{errors.reason}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1.5">
                            {form.reason.length}/200 karakter
                        </p>
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
                <div className="px-6 pb-4">
                    <p className="text-xs text-gray-400 text-center">
                        Pengajuan akan dicatat sebagai rekap kehadiran
                    </p>
                </div>
            </div>
        </div>
    );
};

export default IzinModal;
