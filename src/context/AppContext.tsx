import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

// Types
export interface Teacher {
    id: number;
    userId: number;
    name: string;
    nip: string;
    employeeId?: string;
    phone?: string;
}

export interface Class {
    id: number;
    name: string;
    level: number;
    academicYear?: string;
}

export interface Student {
    id: number;
    userId: number;
    name: string;
    classId: number;
    nis: string;
    dateOfBirth?: string;
    gender?: 'L' | 'P';
}

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';

export interface AttendanceRecord {
    id: number;
    date: string;
    userId: number;
    userType: 'teacher' | 'student';
    status: AttendanceStatus;
    checkInTime?: string;
    checkOutTime?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
}

interface AppContextType {
    teachers: Teacher[];
    classes: Class[];
    students: Student[];
    attendance: AttendanceRecord[];
    loading: boolean;
    error: string | null;
    fetchData: () => Promise<void>;
    addAttendance: (record: any) => Promise<void>;
    getAttendanceForDate: (date: string) => AttendanceRecord[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch data in parallel
            const [teachersRes, classesRes, studentsRes] = await Promise.allSettled([
                api.get('/teachers'),
                api.get('/classes'),
                api.get('/students')
            ]);

            // Handle teachers response
            if (teachersRes.status === 'fulfilled') {
                setTeachers(teachersRes.value.data.teachers || []);
            }

            // Handle classes response
            if (classesRes.status === 'fulfilled') {
                setClasses(classesRes.value.data.classes || []);
            }

            // Handle students response
            if (studentsRes.status === 'fulfilled') {
                setStudents(studentsRes.value.data.students || []);
            }

            // Fetch today's attendance initially
            const today = new Date().toISOString().split('T')[0];
            try {
                const attendanceRes = await api.get(`/attendance?date=${today}`);
                setAttendance(attendanceRes.data.attendance || []);
            } catch (err) {
                console.warn('Failed to fetch initial attendance', err);
            }

        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Gagal memuat data dari server');
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch initial data on mount (if authenticated)
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [fetchData]);

    const addAttendance = async (record: any) => {
        try {
            // Optimistic update (optional, but skipping for now to rely on backend validation)

            // Send to backend
            const response = await api.post('/attendance/scan', record);

            // Update local state with returned record
            if (response.data.attendance) {
                setAttendance(prev => [...prev, response.data.attendance]);

                // Refresh data to ensure consistency
                await fetchData();
            }
        } catch (err: any) {
            console.error('Failed to add attendance:', err);
            throw new Error(err.response?.data?.error || 'Gagal mencatat kehadiran');
        }
    };

    const getAttendanceForDate = (date: string) => {
        return attendance.filter(a => a.date === date);
    };

    return (
        <AppContext.Provider value={{
            teachers,
            classes,
            students,
            attendance,
            loading,
            error,
            fetchData,
            addAttendance,
            getAttendanceForDate
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};
