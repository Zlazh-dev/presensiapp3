import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, AlertTriangle, Loader2, Calendar } from 'lucide-react';
import api from '../../lib/api';

interface LeaveRecord {
    id: number;
    date: string;
    status: 'sick' | 'permission';
    statusLabel: string;
    reason: string | null;
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
        return null; // Silently hide if error
    }

    if (!leaves || leaves.length === 0) {
        return null; // Don't show section if no history
    }

    // Show only last 3 entries
    const recentLeaves = leaves.slice(0, 3);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Riwayat Izin Terbaru</h3>
            </div>
            <div className="divide-y divide-gray-100">
                {recentLeaves.map((leave) => (
                    <div key={leave.id} className="px-5 py-3 flex items-center gap-4">
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
                            </div>
                            {leave.reason && (
                                <p className="text-xs text-gray-500 mt-1 truncate">
                                    {leave.reason}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LeaveHistory;
