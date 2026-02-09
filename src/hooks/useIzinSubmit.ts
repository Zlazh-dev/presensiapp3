import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface IzinFormData {
    type: 'sick' | 'permission';
    date: string;
    reason?: string;
}

interface IzinResponse {
    success: boolean;
    message: string;
    attendance?: {
        id: number;
        date: string;
        status: string;
    };
}

export const useIzinSubmit = (onSuccess?: () => void) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: IzinFormData): Promise<IzinResponse> => {
            const response = await api.post('/attendance/guru/submit-leave', {
                type: data.type,
                date: data.date,
                reason: data.reason || undefined,
            });
            return response.data;
        },
        onSuccess: () => {
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['guru-attendance'] });
            queryClient.invalidateQueries({ queryKey: ['leave-history'] });
            onSuccess?.();
        },
    });
};

export const useLeaveHistory = () => {
    return {
        queryKey: ['leave-history'],
        queryFn: async () => {
            const response = await api.get('/attendance/guru/leave-history');
            return response.data.leaves;
        },
    };
};
