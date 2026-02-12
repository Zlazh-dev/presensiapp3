import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, AlertTriangle, Loader2, Calendar, Paperclip, BookOpen } from 'lucide-react';
import api from '../../lib/api';

interface LeaveRecord {
    id: number;
    date: string;
    status: 'sick' | 'permission';
    statusLabel: string;
    reason: string | null;
    assignmentText: string | null;
    attachmentUrl: string | null;
    createdAt: string;
}

export const LeaveHistory: React.FC = () => {
    const { data: leaves, isLoading, error } = useQuery<LeaveRecord[]>({
        queryKey: ['leave-history'],
        queryFn: async () => {
            const res = await api.get('/attendance/guru/leave-history');
            return res.data.leaves || [];
        },
        staleTime: 30000,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-6 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Memuat riwayat...</span>
            </div>
        );
    }

    if (error) {
        return null;
    }

    if (!leaves || leaves.length === 0) {
        return null;
    }

    // Show only last 5 entries
    const recentLeaves = leaves.slice(0, 5);

    const handleDownload = async (id: number) => {
        try {
            const response = await api.get(`/attendance/guru/leave-attachment/${id}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = response.headers['content-disposition']?.split('filename=')[1] || `tugas-${id}`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            // silently ignore
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Riwayat Izin Terbaru</h3>
            </div>
            <div className="divide-y divide-gray-100">
                {recentLeaves.map((leave) => (
                    <div key={leave.id} className="px-5 py-3">
                        <div className="flex items-center gap-4">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${leave.status === 'sick'
                                ? 'bg-amber-100'
                                : 'bg-blue-100'
                                }`}>
                                {leave.status === 'sick' ? (
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                ) : (
                                    <FileText className="w-4 h-4 text-blue-600" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${leave.status === 'sick'
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-blue-50 text-blue-700'
                                        }`}>
                                        {leave.statusLabel}
                                    </span>
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(leave.date).toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </span>
                                    {/* Assignment indicators */}
                                    {leave.attachmentUrl && (
                                        <span className="text-xs text-green-600 flex items-center gap-0.5" title="File tugas terlampir">
                                            <Paperclip className="w-3 h-3" />
                                        </span>
                                    )}
                                    {leave.assignmentText && (
                                        <span className="text-xs text-indigo-600 flex items-center gap-0.5" title="Tugas tertulis">
                                            <BookOpen className="w-3 h-3" />
                                        </span>
                                    )}
                                </div>
                                {leave.reason && (
                                    <p className="text-xs text-gray-500 mt-1 truncate">
                                        {leave.reason}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Assignment info row */}
                        {(leave.assignmentText || leave.attachmentUrl) && (
                            <div className="mt-2 ml-13 pl-13 flex items-center gap-2" style={{ marginLeft: '52px' }}>
                                {leave.assignmentText && (
                                    <p className="text-xs text-gray-400 truncate flex-1">
                                        📝 {leave.assignmentText}
                                    </p>
                                )}
                                {leave.attachmentUrl && (
                                    <button
                                        onClick={() => handleDownload(leave.id)}
                                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
                                    >
                                        <Paperclip className="w-3 h-3" />
                                        Download
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LeaveHistory;
