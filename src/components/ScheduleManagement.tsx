import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Plus, Edit, Trash2, Calendar, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';

// Temporary interface definitions until we have proper types shared
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

interface ClassModel {
    id: number;
    name: string;
    academicYear: string;
}

interface Subject {
    id: number;
    name: string;
    code: string;
}

interface Teacher {
    id: number;
    user: { name: string };
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

const ScheduleManagement = () => {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [classes, setClasses] = useState<ClassModel[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('1'); // Default to Monday

    const [formData, setFormData] = useState({
        classId: '',
        subjectId: '',
        teacherId: '',
        dayOfWeek: '1',
        startTime: '07:00',
        endTime: '08:30',
        academicYear: '2026/2027' // Default, should ideally come from global config or selected class
    });

    const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const headers = getAuthHeader();

            // Promise.all for parallel fetching
            const [schedulesRes, classesRes, subjectsRes, teachersRes] = await Promise.all([
                fetch('/api/schedules', { headers }),
                fetch('/api/classes', { headers }),
                fetch('/api/subjects', { headers }),
                fetch('/api/teachers', { headers })
            ]);

            if (schedulesRes.ok) {
                const data = await schedulesRes.json();
                setSchedules(data.schedules);
            }
            if (classesRes.ok) {
                const data = await classesRes.json();
                setClasses(data.classes);
            }
            if (subjectsRes.ok) {
                const data = await subjectsRes.json();
                // Check if subjects exists in response, might need adjustment if endpoint returns array directly
                setSubjects(data.subjects || []);
            }
            if (teachersRes.ok) {
                const data = await teachersRes.json();
                setTeachers(data.teachers);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            setError('Gagal memuat data jadwal');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Set active tab to current day
        const today = new Date().getDay(); // 0 = Sunday, 1 = Monday...
        const mappedDay = today === 0 ? 7 : today;
        setActiveTab(mappedDay.toString());
    }, []);

    const resetForm = () => {
        setFormData({
            classId: '',
            subjectId: '',
            teacherId: '',
            dayOfWeek: activeTab, // Default to active tab
            startTime: '07:00',
            endTime: '08:30',
            academicYear: '2026/2027'
        });
        setEditingId(null);
        setError(null);
    };

    const handleOpenModal = (schedule?: Schedule) => {
        if (schedule) {
            setEditingId(schedule.id);
            setFormData({
                classId: schedule.classId.toString(),
                subjectId: schedule.subjectId.toString(),
                teacherId: schedule.teacherId.toString(),
                dayOfWeek: schedule.dayOfWeek.toString(),
                startTime: schedule.startTime.substring(0, 5), // HH:mm:ss -> HH:mm
                endTime: schedule.endTime.substring(0, 5),
                academicYear: schedule.academicYear
            });
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Basic validation
        if (formData.startTime >= formData.endTime) {
            setError('Waktu mulai harus lebih awal dari waktu selesai');
            return;
        }

        try {
            const headers = getAuthHeader();
            const url = editingId
                ? `/api/schedules/${editingId}`
                : '/api/schedules';

            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal menyimpan jadwal');
            }

            await fetchData(); // Refresh list
            setIsModalOpen(false);
            resetForm();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) return;

        try {
            const headers = getAuthHeader();
            const response = await fetch(`/api/schedules/${id}`, {
                method: 'DELETE',
                headers
            });

            if (!response.ok) {
                throw new Error('Gagal menghapus jadwal');
            }

            setSchedules(schedules.filter(s => s.id !== id));
        } catch (err: any) {
            alert(err.message);
        }
    };

    // const getDayName = (day: number) => DAYS.find(d => d.value === day)?.label || 'Unknown';

    const renderScheduleTable = (daySchedules: Schedule[]) => {
        if (daySchedules.length === 0) {
            return (
                <div className="text-center py-8 text-muted-foreground">
                    <p>Belum ada jadwal untuk hari ini.</p>
                </div>
            );
        }

        return (
            <div className="rounded-md border">
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-10 px-4 align-middle font-medium">Jam</th>
                                <th className="h-10 px-4 align-middle font-medium">Kelas</th>
                                <th className="h-10 px-4 align-middle font-medium">Mata Pelajaran</th>
                                <th className="h-10 px-4 align-middle font-medium">Guru</th>
                                <th className="h-10 px-4 align-middle font-medium text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {daySchedules.map((schedule) => (
                                <tr key={schedule.id} className="border-b transition-colors hover:bg-muted/50">
                                    <td className="p-3 align-middle">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3 text-muted-foreground" />
                                            {schedule.startTime.substring(0, 5)} - {schedule.endTime.substring(0, 5)}
                                        </div>
                                    </td>
                                    <td className="p-3 align-middle">
                                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                            {schedule.class?.name}
                                        </span>
                                    </td>
                                    <td className="p-3 align-middle font-medium">{schedule.subject?.name}</td>
                                    <td className="p-3 align-middle text-muted-foreground">{schedule.teacher?.user?.name}</td>
                                    <td className="p-3 align-middle text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(schedule)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(schedule.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Manajemen Jadwal Pelajaran
                    </CardTitle>
                    <CardDescription>Kelola jadwal mata pelajaran untuk setiap kelas.</CardDescription>
                </div>
                <Button onClick={() => handleOpenModal()} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Jadwal
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="text-center py-4">Memuat data...</div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="w-full justify-start mb-4 overflow-x-auto">
                            {DAYS.map(day => (
                                <TabsTrigger key={day.value} value={day.value.toString()} className="flex-1">
                                    {day.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {DAYS.map(day => (
                            <TabsContent key={day.value} value={day.value.toString()}>
                                {renderScheduleTable(schedules.filter(s => s.dayOfWeek === day.value))}
                            </TabsContent>
                        ))}
                    </Tabs>
                )}
            </CardContent>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? "Edit Jadwal" : "Tambah Jadwal Baru"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Kelas</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.classId}
                                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                required
                            >
                                <option value="">Pilih Kelas</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Hari</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.dayOfWeek}
                                onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                                required
                            >
                                {DAYS.map(d => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Mata Pelajaran</label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.subjectId}
                            onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                            required
                        >
                            <option value="">Pilih Mata Pelajaran</option>
                            {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Guru</label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.teacherId}
                            onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                            required
                        >
                            <option value="">Pilih Guru</option>
                            {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.user?.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Jam Mulai</label>
                            <input
                                type="time"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.startTime}
                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Jam Selesai</label>
                            <input
                                type="time"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.endTime}
                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Tahun Ajaran</label>
                        <input
                            type="text"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.academicYear}
                            onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                            placeholder="Contoh: 2026/2027"
                            required
                        />
                    </div>

                    <div className="flex justify-end pt-4 space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Batal
                        </Button>
                        <Button type="submit">
                            {editingId ? "Simpan Perubahan" : "Tambah Jadwal"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </Card>
    );
};

export default ScheduleManagement;
