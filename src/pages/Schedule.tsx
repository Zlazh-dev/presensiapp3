import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { io, Socket } from 'socket.io-client';
import { Clock, Loader2 } from 'lucide-react';

interface Schedule {
    id: number;
    teacherId: number;
    classId: number;
    subjectId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    academicYear: string;
    class?: { id: number; name: string };
    subject?: { id: number; name: string };
    teacher?: { id: number; user?: { name: string } };
}

const DAYS = [
    { value: 1, label: 'Senin' },
    { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' },
    { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' },
    { value: 6, label: 'Sabtu' },
    { value: 7, label: 'Minggu' },
];

const Schedule = () => {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [, setSocket] = useState<Socket | null>(null);

    const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const fetchSchedules = async () => {
        try {
            const response = await fetch('/api/schedules', {
                headers: getAuthHeader()
            });
            if (response.ok) {
                const data = await response.json();
                setSchedules(data.schedules);
            } else {
                setError('Gagal memuat jadwal');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Terjadi kesalahan koneksi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();

        // Initialize Socket.IO connection
        const newSocket = io(window.location.origin);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to socket server');
        });

        newSocket.on('schedule:created', (newSchedule: Schedule) => {
            console.log('Schedule created:', newSchedule);
            setSchedules(prev => {
                const updated = [...prev, newSchedule];
                // Sort by day and time
                return updated.sort((a, b) => {
                    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
                    return a.startTime.localeCompare(b.startTime);
                });
            });
        });

        newSocket.on('schedule:updated', (updatedSchedule: Schedule) => {
            console.log('Schedule updated:', updatedSchedule);
            setSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s));
        });

        newSocket.on('schedule:deleted', (deletedId: number) => {
            console.log('Schedule deleted:', deletedId);
            setSchedules(prev => prev.filter(s => s.id !== deletedId));
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const getDayName = (day: number) => DAYS.find(d => d.value === day)?.label || 'Unknown';

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Jadwal Pelajaran</h1>
            <p className="text-muted-foreground">Jadwal ini diperbarui secara real-time.</p>

            <div className="grid gap-6 md:grid-cols-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Jadwal Pelajaran</CardTitle>
                        <CardDescription>Semua jadwal pelajaran aktif saat ini.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error ? (
                            <div className="text-destructive text-center py-4">{error}</div>
                        ) : (
                            <div className="rounded-md border">
                                <div className="relative w-full overflow-auto">
                                    <table className="w-full caption-bottom text-sm text-left">
                                        <thead className="[&_tr]:border-b">
                                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                                <th className="h-12 px-4 align-middle font-medium">Hari</th>
                                                <th className="h-12 px-4 align-middle font-medium">Jam</th>
                                                <th className="h-12 px-4 align-middle font-medium">Kelas</th>
                                                <th className="h-12 px-4 align-middle font-medium">Mata Pelajaran</th>
                                                <th className="h-12 px-4 align-middle font-medium">Guru</th>
                                            </tr>
                                        </thead>
                                        <tbody className="[&_tr:last-child]:border-0">
                                            {schedules.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                                                        Belum ada jadwal.
                                                    </td>
                                                </tr>
                                            ) : (
                                                schedules.map((schedule) => (
                                                    <tr key={schedule.id} className="border-b transition-colors hover:bg-muted/50">
                                                        <td className="p-4 align-middle font-medium">{getDayName(schedule.dayOfWeek)}</td>
                                                        <td className="p-4 align-middle">
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="w-3 h-3 text-muted-foreground" />
                                                                {schedule.startTime.substring(0, 5)} - {schedule.endTime.substring(0, 5)}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-middle">
                                                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                                {schedule.class?.name}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 align-middle font-medium">{schedule.subject?.name}</td>
                                                        <td className="p-4 align-middle text-muted-foreground">{schedule.teacher?.user?.name}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Schedule;
