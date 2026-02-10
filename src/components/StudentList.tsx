import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Loader2, Check, X, UserX, Clock } from 'lucide-react';

interface Student {
    id: number;
    name: string;
    nis: string;
}

interface StudentAttendance {
    studentId: number;
    status: 'present' | 'absent' | 'sick' | 'permission' | 'late';
}

interface StudentListProps {
    sessionId: number;
    classId: number; // passed down if needed for fallback queries
}

const StudentList: React.FC<StudentListProps> = ({ sessionId }) => {
    const queryClient = useQueryClient();
    const [attendanceMap, setAttendanceMap] = useState<Record<number, string>>({});

    // 1. Fetch Students (Mocked/Real)
    const { data: students, isLoading } = useQuery({
        queryKey: ['students', sessionId],
        queryFn: async () => {
            // In real app: GET /api/sessions/:id/students
            // const res = await api.get(`/sessions/${sessionId}/students`);
            // return res.data;

            // Mock data
            return [
                { id: 1, name: 'Ahmad Siswa', nis: '12345' },
                { id: 2, name: 'Budi Santoso', nis: '12346' },
                { id: 3, name: 'Citra Dewi', nis: '12347' },
                { id: 4, name: 'Doni Pratama', nis: '12348' },
                { id: 5, name: 'Eka Putri', nis: '12349' },
            ] as Student[];
        },
    });

    // 2. Mutation for Student Attendance
    const mutation = useMutation({
        mutationFn: async (_data: StudentAttendance) => {
            // POST /api/student-attendance
            // return api.post('/student-attendance', { sessionId, studentId, status });

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 500));
            return { success: true };
        },
        onSuccess: (_, variables) => {
            // Optimistic update local state
            setAttendanceMap(prev => ({
                ...prev,
                [variables.studentId]: variables.status
            }));
            queryClient.invalidateQueries({ queryKey: ['attendance-stats', sessionId] });
        },
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-2">Class Attendance</h3>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                {students?.map((student) => (
                    <div key={student.id} className="p-4 border-b last:border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="font-semibold text-gray-900">{student.name}</p>
                            <p className="text-sm text-gray-500">NIS: {student.nis}</p>
                        </div>

                        <div className="flex gap-2">
                            <AttendanceButton
                                status="present"
                                current={attendanceMap[student.id]}
                                onClick={() => mutation.mutate({ studentId: student.id, status: 'present' })}
                                icon={<Check size={16} />}
                                label="Hadir"
                                color="green"
                            />
                            <AttendanceButton
                                status="permission"
                                current={attendanceMap[student.id]}
                                onClick={() => mutation.mutate({ studentId: student.id, status: 'permission' })}
                                icon={<Clock size={16} />}
                                label="Izin"
                                color="yellow"
                            />
                            <AttendanceButton
                                status="sick"
                                current={attendanceMap[student.id]}
                                onClick={() => mutation.mutate({ studentId: student.id, status: 'sick' })}
                                icon={<UserX size={16} />}
                                label="Sakit"
                                color="orange"
                            />
                            <AttendanceButton
                                status="absent"
                                current={attendanceMap[student.id]}
                                onClick={() => mutation.mutate({ studentId: student.id, status: 'absent' })}
                                icon={<X size={16} />}
                                label="Alpha"
                                color="red"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Helper Component for Buttons
interface BtnProps {
    status: string;
    current?: string;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    color: 'green' | 'red' | 'yellow' | 'orange';
}

const AttendanceButton: React.FC<BtnProps> = ({ status, current, onClick, icon, label, color }) => {
    const isSelected = current === status;

    const colorClasses = {
        green: isSelected ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100',
        red: isSelected ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100',
        yellow: isSelected ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100',
        orange: isSelected ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100',
    };

    return (
        <button
            onClick={onClick}
            className={`p-2 rounded-md flex flex-col items-center justify-center min-w-[60px] transition-all ${colorClasses[color]}`}
        >
            {icon}
            <span className="text-[10px] uppercase font-bold mt-1">{label}</span>
        </button>
    );
};

export default StudentList;
