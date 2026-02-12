import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface IzinFormData {
    type: 'sick' | 'permission';
    date: string;
    reason: string;
    assignmentText?: string;
    file?: File;
}

interface IzinResponse {
    success: boolean;
    message: string;
    sessionsCascaded?: number;
    autoCheckedOut?: boolean;
    impactedSessions?: number;
}

export const useIzinSubmit = (onSuccess?: () => void) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: IzinFormData): Promise<IzinResponse> => {
            const formData = new FormData();
            formData.append('type', data.type);
            formData.append('date', data.date);
            formData.append('reason', data.reason);
            if (data.assignmentText) {
                formData.append('assignmentText', data.assignmentText);
            }
            if (data.file) {
                formData.append('file', data.file);
            }

            const response = await api.post('/attendance/guru/submit-leave', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
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
