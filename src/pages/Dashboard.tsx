import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
    const { teachers, students, attendance } = useApp();

    // Calculate stats
    const totalTeachers = teachers.length;
    const totalStudents = students.length;
    const today = new Date().toISOString().split('T')[0];
    const todaysAttendance = attendance.filter(a => a.date === today);
    const presentCount = todaysAttendance.filter(a => a.status === 'Hadir').length;
    const absentCount = totalTeachers + totalStudents - presentCount; // Simplified logic

    // Chart data
    const data = [
        { name: 'Senin', hadir: 40, sakit: 2, izin: 1, alpa: 0 },
        { name: 'Selasa', hadir: 38, sakit: 1, izin: 3, alpa: 1 },
        { name: 'Rabu', hadir: 42, sakit: 0, izin: 1, alpa: 0 },
        { name: 'Kamis', hadir: 39, sakit: 2, izin: 2, alpa: 0 },
        { name: 'Jumat', hadir: 41, sakit: 1, izin: 1, alpa: 0 },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Presensi</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Guru</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalTeachers}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalStudents}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Hadir Hari Ini</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{presentCount}</div>
                        <p className="text-xs text-muted-foreground">
                            {((presentCount / (totalTeachers + totalStudents)) * 100).toFixed(1)}% kehadiran
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tidak Hadir</CardTitle>
                        <UserX className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{absentCount}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Overview Kehadiran Minggu Ini</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="name" className="text-xs" />
                                <YAxis className="text-xs" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                                <Bar dataKey="hadir" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="sakit" fill="currentColor" className="fill-yellow-500" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="izin" fill="currentColor" className="fill-blue-500" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="alpa" fill="currentColor" className="fill-destructive" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Aktivitas Terkini</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {todaysAttendance.slice(0, 5).map((record) => (
                                <div key={record.id} className="flex items-center">
                                    <div className="ml-4 space-y-1">
                                        <p className="text-sm font-medium leading-none">
                                            {teachers.find(t => t.id === record.userId)?.name || students.find(s => s.id === record.userId)?.name || 'Unknown User'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {record.userType === 'teacher' ? 'Guru' : 'Siswa'} • {record.status}
                                        </p>
                                    </div>
                                    <div className="ml-auto font-medium text-xs flex items-center gap-1 text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {record.checkInTime}
                                    </div>
                                </div>
                            ))}
                            {todaysAttendance.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center">Belum ada presensi hari ini.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
