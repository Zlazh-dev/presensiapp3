import React, { useState, useCallback, useRef } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import {
    Save, Calendar, Clock, Users, Plus, X,
    Trash2, Edit2, Loader2, AlertTriangle,
    CalendarOff, Grid3X3, RefreshCw, Upload, Download,
    Settings as SettingsIcon, CheckSquare, QrCode, Printer,
    MapPin, Database, ShieldAlert, HardDrive,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import GeofenceTab from '../components/GeofenceTab';
import BackupTab from '../components/settings/BackupTab';

// ─── Types ────────────────────────────────────────────
interface TimeSlot {
    id: number;
    slotNumber: number;
    startTime: string;
    endTime: string;
}

interface HolidayEvent {
    id: number;
    date: string;
    reason: string;
    type: 'national' | 'school' | 'meeting';
    classId: number | null;
    isActive: boolean;
    class?: { id: number; name: string } | null;
}

interface ClassOption {
    id: number;
    name: string;
}

const HOLIDAY_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    national: { label: 'Nasional', color: 'bg-red-100 text-red-800' },
    school: { label: 'Sekolah', color: 'bg-amber-100 text-amber-800' },
    meeting: { label: 'Rapat', color: 'bg-purple-100 text-purple-800' },
};

// ─── API ──────────────────────────────────────────────
const API = '/api';
const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
});
const fetchJSON = async (url: string) => {
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

// ─── Max Slots ────────────────────────────────────────
const MAX_SLOTS = 8;

// ─── Working Hours Types ──────────────────────────────
interface WorkingHoursDay {
    id: number;
    dayOfWeek: number;
    dayLabel: string;
    startTime: string;
    endTime: string;
    toleranceBeforeMin: number;
    lateAfterMin: number;
}
interface WorkingHoursTeacher {
    teacherId: number;
    teacherName: string;
    employeeId: string;
    days: WorkingHoursDay[];
}
interface GuruRoomQR {
    qrCode: string;
    label: string;
    description: string;
}

const DAY_LABELS = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DAY_FULL = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const Settings: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // ── Time Slot state ──
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
    const [slotForm, setSlotForm] = useState({ slotNumber: '', startTime: '', endTime: '' });
    const [slotError, setSlotError] = useState<string | null>(null);

    // ── Holiday state ──
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState<HolidayEvent | null>(null);
    const [holidayForm, setHolidayForm] = useState({ date: '', reason: '', type: 'national', classId: '' });
    const [holidayError, setHolidayError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Working Hours state ──
    const [showCustomDayModal, setShowCustomDayModal] = useState(false);
    const [customDayForm, setCustomDayForm] = useState({ teacherId: 0, dayOfWeek: 7, startTime: '07:00', endTime: '15:00' });

    // ── Mass setup state ──
    const [massStartTime, setMassStartTime] = useState('07:00');
    const [massEndTime, setMassEndTime] = useState('15:00');
    const [massTolerance, setMassTolerance] = useState(30);
    const [massLate, setMassLate] = useState(60);

    // ── QR state ──
    const [showQRModal, setShowQRModal] = useState(false);
    const [roomQR, setRoomQR] = useState<GuruRoomQR | null>(null);

    // ── Data Cleanup state ──
    const [cleanupType, setCleanupType] = useState<'all' | 'range'>('range');
    const [cleanupStartDate, setCleanupStartDate] = useState('');
    const [cleanupEndDate, setCleanupEndDate] = useState('');
    const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
    const [cleanupConfirmText, setCleanupConfirmText] = useState('');
    const [qrLoading, setQrLoading] = useState(false);

    // ── Time Slot query ──
    const { data: timeSlotsData, isLoading: slotsLoading } = useQuery({
        queryKey: ['timeSlots'],
        queryFn: () => fetchJSON(`${API}/time-slots`),
    });
    const timeSlots: TimeSlot[] = timeSlotsData?.timeSlots || [];

    // ── Holiday queries ──
    const { data: holidaysData, isLoading: holidaysLoading } = useQuery({
        queryKey: ['holidays'],
        queryFn: () => fetchJSON(`${API}/holidays`),
    });
    const holidays: HolidayEvent[] = holidaysData?.holidays || [];

    const { data: classesData } = useQuery({
        queryKey: ['classes'],
        queryFn: () => fetchJSON(`${API}/classes`),
    });
    const classes: ClassOption[] = (classesData?.classes || []).map((c: any) => ({ id: c.id, name: c.name }));

    // ── Working Hours query ──
    const { data: whData, isLoading: whLoading } = useQuery({
        queryKey: ['workingHours'],
        queryFn: () => fetchJSON(`${API}/working-hours`),
    });
    const workingHoursTeachers: WorkingHoursTeacher[] = whData?.workingHours || [];

    // ── Working Hours toggle mutation ──
    const toggleDayMutation = useMutation({
        mutationFn: async (data: { teacherId: number; dayOfWeek: number; enabled: boolean; startTime?: string; endTime?: string }) => {
            const res = await fetch(`${API}/working-hours/toggle`, {
                method: 'PUT', headers: getHeaders(), body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workingHours'] }),
    });

    const updateTimeMutation = useMutation({
        mutationFn: async (data: { id: number; startTime: string; endTime: string }) => {
            const res = await fetch(`${API}/working-hours/${data.id}`, {
                method: 'PUT', headers: getHeaders(), body: JSON.stringify({ startTime: data.startTime, endTime: data.endTime }),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workingHours'] }),
    });

    const addCustomDayMutation = useMutation({
        mutationFn: async (data: { teacherId: number; dayOfWeek: number; startTime: string; endTime: string }) => {
            const res = await fetch(`${API}/working-hours`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workingHours'] });
            setShowCustomDayModal(false);
        },
    });

    // ── Tolerance update mutation ──
    const updateToleranceMutation = useMutation({
        mutationFn: async (data: { id: number; toleranceBeforeMin?: number; lateAfterMin?: number; startTime: string; endTime: string }) => {
            const res = await fetch(`${API}/working-hours/${data.id}`, {
                method: 'PUT', headers: getHeaders(),
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workingHours'] }),
    });

    // ── Bulk update mutation ──
    const bulkUpdateMutation = useMutation({
        mutationFn: async (data: { days?: number[]; startTime?: string; endTime?: string; toleranceBeforeMin?: number; lateAfterMin?: number }) => {
            const res = await fetch(`${API}/working-hours/bulk-update`, {
                method: 'PUT', headers: getHeaders(),
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workingHours'] }),
    });

    // ── Mutations ──
    const createSlotMutation = useMutation({
        mutationFn: async (data: { slotNumber: number; startTime: string; endTime: string }) => {
            const res = await fetch(`${API}/time-slots`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal membuat jam pelajaran');
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeSlots'] });
            closeSlotModal();
        },
        onError: (err: Error) => setSlotError(err.message),
    });

    const updateSlotMutation = useMutation({
        mutationFn: async ({ id, ...data }: { id: number; slotNumber: number; startTime: string; endTime: string }) => {
            const res = await fetch(`${API}/time-slots/${id}`, {
                method: 'PUT', headers: getHeaders(), body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal mengubah jam pelajaran');
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeSlots'] });
            closeSlotModal();
        },
        onError: (err: Error) => setSlotError(err.message),
    });

    const deleteSlotMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`${API}/time-slots/${id}`, {
                method: 'DELETE', headers: getHeaders(),
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Gagal menghapus');
            }
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timeSlots'] }),
    });

    // ── Holiday mutations ──
    const createHolidayMutation = useMutation({
        mutationFn: async (data: { date: string; reason: string; type: string; classId?: number | null }) => {
            const res = await fetch(`${API}/holidays`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal membuat libur');
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['holidays'] });
            closeHolidayModal();
        },
        onError: (err: Error) => setHolidayError(err.message),
    });

    const updateHolidayMutation = useMutation({
        mutationFn: async ({ id, ...data }: { id: number; date: string; reason: string; type: string; classId?: number | null }) => {
            const res = await fetch(`${API}/holidays/${id}`, {
                method: 'PUT', headers: getHeaders(), body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal mengubah libur');
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['holidays'] });
            closeHolidayModal();
        },
        onError: (err: Error) => setHolidayError(err.message),
    });

    const deleteHolidayMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`${API}/holidays/${id}`, {
                method: 'DELETE', headers: getHeaders(),
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Gagal menghapus');
            }
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
    });

    // ── Cleanup attendance mutation ──
    const cleanupMutation = useMutation({
        mutationFn: async (data: { type: 'all' | 'range'; startDate?: string; endDate?: string; confirmText: string }) => {
            const res = await fetch(`${API}/admin/cleanup-attendance`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || json.message || 'Gagal menghapus data');
            return json;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            queryClient.invalidateQueries({ queryKey: ['rekapGuru'] });
            queryClient.invalidateQueries({ queryKey: ['rekapSiswa'] });
            setShowCleanupConfirm(false);
            setCleanupConfirmText('');
            alert(`✅ ${data.message}\n\nDihapus:\n- ${data.deleted.teacherRecords} rekap guru\n- ${data.deleted.studentRecords} rekap siswa\n- ${data.deleted.sessions} sesi`);
        },
        onError: (err: Error) => {
            alert(`❌ Gagal: ${err.message}`);
        },
    });

    const importHolidaysMutation = useMutation({
        mutationFn: async (data: any[]) => {
            const res = await fetch(`${API}/holidays/import`, {
                method: 'POST', headers: getHeaders(), body: JSON.stringify({ holidays: data }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Gagal import');
            return json;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['holidays'] });
            alert(data.message);
        },
        onError: (err: Error) => alert(`Import gagal: ${err.message}`),
    });

    // ── Handlers ──
    const openAddSlot = useCallback(() => {
        const nextNumber = timeSlots.length > 0
            ? Math.max(...timeSlots.map(t => t.slotNumber)) + 1
            : 1;
        const lastEnd = timeSlots.length > 0
            ? timeSlots[timeSlots.length - 1].endTime
            : '07:00';
        // Auto-calculate next end time (+1 hour)
        const [h, m] = lastEnd.split(':').map(Number);
        const nextEnd = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        setEditingSlot(null);
        setSlotForm({ slotNumber: String(nextNumber), startTime: lastEnd, endTime: nextEnd });
        setSlotError(null);
        setShowSlotModal(true);
    }, [timeSlots]);

    const openEditSlot = useCallback((slot: TimeSlot) => {
        setEditingSlot(slot);
        setSlotForm({
            slotNumber: String(slot.slotNumber),
            startTime: slot.startTime,
            endTime: slot.endTime,
        });
        setSlotError(null);
        setShowSlotModal(true);
    }, []);

    const closeSlotModal = useCallback(() => {
        setShowSlotModal(false);
        setEditingSlot(null);
        setSlotError(null);
    }, []);

    const validateSlotForm = useCallback((): string | null => {
        const { startTime, endTime, slotNumber } = slotForm;
        const num = Number(slotNumber);

        if (!startTime || !endTime || !slotNumber) return 'Semua field harus diisi';
        if (num < 1 || num > MAX_SLOTS) return `Nomor jam harus antara 1-${MAX_SLOTS}`;
        if (endTime <= startTime) return 'Jam selesai harus lebih dari jam mulai';

        // Check max slots (only for create)
        if (!editingSlot && timeSlots.length >= MAX_SLOTS) return `Maksimal ${MAX_SLOTS} jam pelajaran`;

        // Check overlap with existing slots (excluding current if editing)
        const otherSlots = timeSlots.filter(t => editingSlot ? t.id !== editingSlot.id : true);
        for (const existing of otherSlots) {
            if (startTime < existing.endTime && endTime > existing.startTime) {
                return `Overlap dengan Jam ke-${existing.slotNumber} (${existing.startTime}-${existing.endTime})`;
            }
            if (num === existing.slotNumber) {
                return `Jam ke-${num} sudah ada`;
            }
        }

        return null;
    }, [slotForm, timeSlots, editingSlot]);

    const handleSlotSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const error = validateSlotForm();
        if (error) {
            setSlotError(error);
            return;
        }

        const payload = {
            slotNumber: Number(slotForm.slotNumber),
            startTime: slotForm.startTime,
            endTime: slotForm.endTime,
        };

        if (editingSlot) {
            updateSlotMutation.mutate({ id: editingSlot.id, ...payload });
        } else {
            createSlotMutation.mutate(payload);
        }
    }, [slotForm, editingSlot, validateSlotForm, createSlotMutation, updateSlotMutation]);

    const [confirmState, setConfirmState] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel: string;
        variant: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', confirmLabel: '', variant: 'danger', onConfirm: () => { } });

    const showConfirm = useCallback((opts: Omit<typeof confirmState, 'open'>) => {
        setConfirmState({ ...opts, open: true });
    }, []);

    const closeConfirm = useCallback(() => {
        setConfirmState(prev => ({ ...prev, open: false }));
    }, []);

    const handleDeleteSlot = useCallback((slot: TimeSlot) => {
        showConfirm({
            title: 'Hapus Jam Pelajaran?',
            message: `Jam ke-${slot.slotNumber} (${slot.startTime} - ${slot.endTime}) akan dihapus permanen.`,
            confirmLabel: 'Hapus',
            variant: 'danger',
            onConfirm: () => { deleteSlotMutation.mutate(slot.id); closeConfirm(); },
        });
    }, [deleteSlotMutation, showConfirm, closeConfirm]);

    const handleRefreshGrids = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['timeSlots'] });
        queryClient.invalidateQueries({ queryKey: ['scheduleGrid'] });
        alert('Jadwal grids di-refresh!');
    }, [queryClient]);

    // ── Holiday handlers ──
    const openAddHoliday = useCallback(() => {
        setEditingHoliday(null);
        setHolidayForm({ date: '', reason: '', type: 'national', classId: '' });
        setHolidayError(null);
        setShowHolidayModal(true);
    }, []);

    const openEditHoliday = useCallback((h: HolidayEvent) => {
        setEditingHoliday(h);
        setHolidayForm({
            date: h.date,
            reason: h.reason,
            type: h.type,
            classId: h.classId ? String(h.classId) : '',
        });
        setHolidayError(null);
        setShowHolidayModal(true);
    }, []);

    const closeHolidayModal = useCallback(() => {
        setShowHolidayModal(false);
        setEditingHoliday(null);
        setHolidayError(null);
    }, []);

    const handleHolidaySubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!holidayForm.date || !holidayForm.reason || !holidayForm.type) {
            setHolidayError('Tanggal, alasan, dan tipe wajib diisi');
            return;
        }

        const payload = {
            date: holidayForm.date,
            reason: holidayForm.reason,
            type: holidayForm.type,
            classId: holidayForm.classId ? Number(holidayForm.classId) : null,
        };

        if (editingHoliday) {
            updateHolidayMutation.mutate({ id: editingHoliday.id, ...payload });
        } else {
            createHolidayMutation.mutate(payload);
        }
    }, [holidayForm, editingHoliday, createHolidayMutation, updateHolidayMutation]);

    const handleDeleteHoliday = useCallback((h: HolidayEvent) => {
        showConfirm({
            title: 'Hapus Hari Libur?',
            message: `Libur "${h.reason}" pada ${h.date} akan dihapus permanen.`,
            confirmLabel: 'Hapus',
            variant: 'danger',
            onConfirm: () => { deleteHolidayMutation.mutate(h.id); closeConfirm(); },
        });
    }, [deleteHolidayMutation, showConfirm, closeConfirm]);

    const handleDownloadTemplate = useCallback(() => {
        const wb = XLSX.utils.book_new();
        const header = [['Tanggal (YYYY-MM-DD)', 'Alasan', 'Tipe (national/school/meeting)', 'KelasID (opsional)']];
        const ws = XLSX.utils.aoa_to_sheet(header);
        ws['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 30 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'template_libur.xlsx');
    }, []);

    const handleImportExcel = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const data = new Uint8Array(ev.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Skip header row
            const holidays = rows.slice(1)
                .filter(r => r[0] && r[1] && r[2])
                .map(r => ({
                    date: String(r[0]),
                    reason: String(r[1]),
                    type: String(r[2]).toLowerCase(),
                    classId: r[3] ? Number(r[3]) : null,
                }));

            if (holidays.length === 0) {
                alert('Tidak ada data valid di file Excel');
                return;
            }

            showConfirm({
                title: 'Import Hari Libur?',
                message: `${holidays.length} data libur dari Excel akan diimport ke sistem.`,
                confirmLabel: 'Import',
                variant: 'info',
                onConfirm: () => { importHolidaysMutation.mutate(holidays); closeConfirm(); },
            });
        };
        reader.readAsArrayBuffer(file);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [importHolidaysMutation]);

    const isHolidayMutating = createHolidayMutation.isPending || updateHolidayMutation.isPending;

    // ── Access check ──
    if (!user || user.role !== 'admin') {
        return (
            <div className="p-8 text-center text-red-600">
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p>Only administrators can access this page.</p>
            </div>
        );
    }

    const handleToggleDay = useCallback((teacherId: number, dayOfWeek: number, currentlyEnabled: boolean) => {
        toggleDayMutation.mutate({ teacherId, dayOfWeek, enabled: !currentlyEnabled });
    }, [toggleDayMutation]);

    const handleTimeChange = useCallback((id: number, field: 'startTime' | 'endTime', value: string, otherValue: string) => {
        const data = field === 'startTime'
            ? { id, startTime: value, endTime: otherValue }
            : { id, startTime: otherValue, endTime: value };
        updateTimeMutation.mutate(data);
    }, [updateTimeMutation]);

    const handleCustomDaySubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!customDayForm.teacherId) return;
        addCustomDayMutation.mutate(customDayForm);
    }, [customDayForm, addCustomDayMutation]);

    const isMutating = createSlotMutation.isPending || updateSlotMutation.isPending;

    // ── QR handlers ──
    const handleGenerateRoomQR = useCallback(async () => {
        setQrLoading(true);
        try {
            const res = await fetch(`${API}/qr/guru-room`, { headers: getHeaders() });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error || 'Gagal generate QR');
                return;
            }
            const data = await res.json();
            setRoomQR(data);
            setShowQRModal(true);
        } catch (err) {
            alert('Gagal generate QR');
        } finally {
            setQrLoading(false);
        }
    }, []);

    const handleDownloadRoomPNG = useCallback(() => {
        if (!roomQR) return;
        const link = document.createElement('a');
        link.download = 'QR_Ruang_Guru.png';
        link.href = roomQR.qrCode;
        link.click();
    }, [roomQR]);

    const handlePrintRoomQR = useCallback(() => {
        if (!roomQR) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <!DOCTYPE html><html><head><title>QR Ruang Guru</title>
            <style>body{font-family:sans-serif;padding:40px;text-align:center;}@media print{body{padding:20px;}}</style>
            </head><body>
            <h2>QR Presensi Ruang Guru</h2>
            <p style="color:#666;margin-bottom:20px;">Tempel di ruang guru — semua guru scan QR ini untuk check-in / check-out</p>
            <img src="${roomQR.qrCode}" style="width:300px;height:300px;" />
            <p style="margin-top:16px;font-size:12px;color:#999;">Scan menggunakan aplikasi PresensiApp</p>
            <script>setTimeout(()=>window.print(),500);<\/script>
            </body></html>
        `);
        printWindow.document.close();
    }, [roomQR]);

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-5xl mx-auto space-y-6">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
                    <p className="text-gray-500">Kelola jam kerja, jadwal mapel, dan hari libur.</p>
                </header>

                <Tabs defaultValue="attendance" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-8">
                        <TabsTrigger value="attendance" className="flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Working Hours
                        </TabsTrigger>
                        <TabsTrigger value="timeslots" className="flex items-center gap-2">
                            <Grid3X3 className="h-4 w-4" /> Jadwal Mapel
                        </TabsTrigger>
                        <TabsTrigger value="holidays" className="flex items-center gap-2">
                            <CalendarOff className="h-4 w-4" /> Manajemen Libur
                        </TabsTrigger>
                        <TabsTrigger value="geofence" className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" /> Geofence
                        </TabsTrigger>
                        <TabsTrigger value="backup" className="flex items-center gap-2 text-emerald-600">
                            <HardDrive className="h-4 w-4" /> Backup
                        </TabsTrigger>
                        <TabsTrigger value="cleanup" className="flex items-center gap-2 text-red-600">
                            <ShieldAlert className="h-4 w-4" /> Cleanup
                        </TabsTrigger>
                    </TabsList>

                    {/* ─── Tab 1: Working Hours ─── */}
                    <TabsContent value="attendance" className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-blue-600" />
                                        Jam Kerja Guru
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Atur hari kerja, toleransi, dan jam kerja per guru — centang hari aktif
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleGenerateRoomQR()}
                                    disabled={qrLoading || whLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
                                >
                                    {qrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                                    Generate QR Ruang Guru
                                </button>
                            </div>

                            {/* Table */}
                            {whLoading ? (
                                <div className="text-center py-12">
                                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-500" />
                                    <p className="text-gray-500 text-sm mt-2">Memuat data...</p>
                                </div>
                            ) : workingHoursTeachers.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                                    <Clock className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                                    <p className="text-gray-500">Belum ada data jam kerja</p>
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-xl overflow-x-auto">
                                    {/* ── Mass Setup Toolbar ── */}
                                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200 px-4 py-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider whitespace-nowrap">Mass Setup:</span>
                                            <div className="flex items-center gap-1.5">
                                                {[1, 2, 3, 4, 5, 6, 7].map(d => {
                                                    // Check if ALL teachers have this day active
                                                    const allHaveDay = workingHoursTeachers.length > 0 && workingHoursTeachers.every(t => t.days.some(dd => dd.dayOfWeek === d));
                                                    return (
                                                        <button
                                                            key={d}
                                                            onClick={() => {
                                                                // Compute new days array: toggle this day for all
                                                                const currentDays = new Set<number>();
                                                                // Build union of all active days from all teachers
                                                                for (const t of workingHoursTeachers) {
                                                                    for (const dd of t.days) currentDays.add(dd.dayOfWeek);
                                                                }
                                                                if (allHaveDay) {
                                                                    currentDays.delete(d);
                                                                } else {
                                                                    currentDays.add(d);
                                                                }
                                                                bulkUpdateMutation.mutate({ days: Array.from(currentDays) });
                                                            }}
                                                            disabled={bulkUpdateMutation.isPending}
                                                            className={`w-7 h-7 rounded-md border-2 flex items-center justify-center text-[10px] font-bold transition-all ${allHaveDay
                                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                                                : 'bg-white border-gray-300 text-gray-400 hover:border-indigo-400'
                                                                }`}
                                                            title={`${allHaveDay ? 'Hapus' : 'Centang'} ${DAY_FULL[d]} untuk semua guru`}
                                                        >
                                                            {DAY_LABELS[d]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="h-5 w-px bg-gray-300 hidden sm:block" />
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <input type="time" value={massStartTime} onChange={e => setMassStartTime(e.target.value)}
                                                    className="px-2 py-1 border border-gray-300 rounded-md text-xs w-[90px] focus:ring-2 focus:ring-indigo-500 outline-none" title="Jam Mulai" />
                                                <input type="time" value={massEndTime} onChange={e => setMassEndTime(e.target.value)}
                                                    className="px-2 py-1 border border-gray-300 rounded-md text-xs w-[90px] focus:ring-2 focus:ring-indigo-500 outline-none" title="Jam Selesai" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-gray-500">Tol</span>
                                                    <input type="number" min={0} max={120} value={massTolerance} onChange={e => setMassTolerance(Number(e.target.value))}
                                                        className="w-12 px-1 py-1 border border-gray-300 rounded-md text-xs text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-gray-500">Telat</span>
                                                    <input type="number" min={0} max={120} value={massLate} onChange={e => setMassLate(Number(e.target.value))}
                                                        className="w-12 px-1 py-1 border border-gray-300 rounded-md text-xs text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                </div>
                                                <button
                                                    onClick={() => bulkUpdateMutation.mutate({
                                                        startTime: massStartTime,
                                                        endTime: massEndTime,
                                                        toleranceBeforeMin: massTolerance,
                                                        lateAfterMin: massLate,
                                                    })}
                                                    disabled={bulkUpdateMutation.isPending}
                                                    className="px-3 py-1 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    {bulkUpdateMutation.isPending ? 'Menerapkan...' : 'Terapkan Semua'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Guru</th>
                                                {[1, 2, 3, 4, 5, 6, 7].map(d => (
                                                    <th key={d} className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-14">
                                                        {DAY_LABELS[d]}
                                                    </th>
                                                ))}
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Jam Mulai</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Jam Selesai</th>
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider" title="Toleransi masuk (menit sebelum jam mulai)">Toleransi</th>
                                                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider" title="Telat setelah X menit dari jam mulai">Telat</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {workingHoursTeachers.map(t => {
                                                const activeDays = new Set(t.days.map(d => d.dayOfWeek));
                                                const firstDay = t.days[0];
                                                const startTime = firstDay?.startTime || '07:00';
                                                const endTime = firstDay?.endTime || '15:00';
                                                const toleranceBefore = firstDay?.toleranceBeforeMin ?? 30;
                                                const lateAfter = firstDay?.lateAfterMin ?? 5;

                                                return (
                                                    <tr key={t.teacherId} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                                                    {t.teacherName.charAt(0)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium text-gray-900 truncate">{t.teacherName}</p>
                                                                    <p className="text-xs text-gray-400">{t.employeeId}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {[1, 2, 3, 4, 5, 6, 7].map(d => {
                                                            const isActive = activeDays.has(d);
                                                            return (
                                                                <td key={d} className="px-2 py-3 text-center">
                                                                    <button
                                                                        onClick={() => handleToggleDay(t.teacherId, d, isActive)}
                                                                        disabled={toggleDayMutation.isPending}
                                                                        className={`
                                                                            w-8 h-8 rounded-lg border-2 flex items-center justify-center
                                                                            transition-all duration-200 text-xs font-bold
                                                                            ${isActive
                                                                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm hover:bg-blue-700'
                                                                                : 'bg-white border-gray-200 text-gray-300 hover:border-blue-300 hover:text-blue-400'
                                                                            }
                                                                        `}
                                                                        title={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} ${DAY_FULL[d]}`}
                                                                    >
                                                                        {isActive ? '✓' : ''}
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="time"
                                                                value={startTime}
                                                                onChange={(e) => {
                                                                    t.days.forEach(d => handleTimeChange(d.id, 'startTime', e.target.value, d.endTime));
                                                                }}
                                                                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="time"
                                                                value={endTime}
                                                                onChange={(e) => {
                                                                    t.days.forEach(d => handleTimeChange(d.id, 'endTime', e.target.value, d.startTime));
                                                                }}
                                                                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                            />
                                                        </td>
                                                        {/* Toleransi (min before) */}
                                                        <td className="px-3 py-3 text-center">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={120}
                                                                value={toleranceBefore}
                                                                onChange={(e) => {
                                                                    const val = Number(e.target.value);
                                                                    t.days.forEach(d => updateToleranceMutation.mutate({
                                                                        id: d.id, toleranceBeforeMin: val,
                                                                        startTime: d.startTime, endTime: d.endTime,
                                                                    }));
                                                                }}
                                                                className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                                title="Menit sebelum jam mulai (scan dibuka)"
                                                            />
                                                        </td>
                                                        {/* Telat Setelah (min after) */}
                                                        <td className="px-3 py-3 text-center">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={120}
                                                                value={lateAfter}
                                                                onChange={(e) => {
                                                                    const val = Number(e.target.value);
                                                                    t.days.forEach(d => updateToleranceMutation.mutate({
                                                                        id: d.id, lateAfterMin: val,
                                                                        startTime: d.startTime, endTime: d.endTime,
                                                                    }));
                                                                }}
                                                                className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                                title="Menit setelah jam mulai (dianggap telat)"
                                                            />
                                                        </td>

                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Info */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-blue-700">
                                    <p className="font-medium">Checklist menentukan hari kerja guru</p>
                                    <p className="mt-0.5 text-blue-600">
                                        Guru hanya bisa check-in QR pada hari yang dicentang.<br />
                                        <strong>Toleransi</strong> = berapa menit sebelum jam mulai QR bisa di-scan.<br />
                                        <strong>Telat</strong> = setelah berapa menit dari jam mulai dianggap telat.
                                    </p>
                                </div>
                            </div>

                            {/* ─── QR Ruang Guru Modal ─── */}
                            {showQRModal && roomQR && (
                                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowQRModal(false)}>
                                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-6 py-4 border-b">
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                                    <QrCode className="w-5 h-5 text-emerald-600" /> {roomQR.label}
                                                </h3>
                                                <p className="text-sm text-gray-500">{roomQR.description}</p>
                                            </div>
                                            <button onClick={() => setShowQRModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                                <X className="w-5 h-5 text-gray-500" />
                                            </button>
                                        </div>
                                        {/* Body */}
                                        <div className="p-8 text-center">
                                            <img src={roomQR.qrCode} alt="QR Ruang Guru" className="w-64 h-64 mx-auto rounded-lg border border-gray-100" />
                                            <p className="text-sm text-gray-500 mt-4">Cetak dan tempel di ruang guru</p>
                                            <div className="flex items-center justify-center gap-3 mt-6">
                                                <button
                                                    onClick={handleDownloadRoomPNG}
                                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                                                >
                                                    <Download className="w-4 h-4" /> Download PNG
                                                </button>
                                                <button
                                                    onClick={handlePrintRoomQR}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                                >
                                                    <Printer className="w-4 h-4" /> Print
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* ─── Tab 4: Jadwal Mapel (Time Slots) ─── */}
                    <TabsContent value="timeslots" className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <Grid3X3 className="w-5 h-5 text-blue-600" />
                                        Jam Pelajaran
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Kelola jam mapel global — digunakan di grid Manajemen Jadwal
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleRefreshGrids}
                                        className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Refresh Jadwal Grids
                                    </button>
                                    <button
                                        onClick={openAddSlot}
                                        disabled={timeSlots.length >= MAX_SLOTS}
                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Tambah Jam
                                    </button>
                                </div>
                            </div>

                            {/* Capacity indicator */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                                        style={{ width: `${(timeSlots.length / MAX_SLOTS) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                                    {timeSlots.length}/{MAX_SLOTS} slot
                                </span>
                            </div>

                            {/* Table */}
                            {slotsLoading ? (
                                <div className="text-center py-12">
                                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-500" />
                                    <p className="text-gray-500 text-sm mt-2">Memuat data...</p>
                                </div>
                            ) : timeSlots.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                                    <Clock className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                                    <p className="text-gray-500">Belum ada jam pelajaran</p>
                                    <button
                                        onClick={openAddSlot}
                                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        + Tambah Jam Pertama
                                    </button>
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">No</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Jam ke-</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mulai</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Selesai</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Durasi</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {timeSlots.map((slot, idx) => {
                                                // Calc duration
                                                const [sh, sm] = slot.startTime.split(':').map(Number);
                                                const [eh, em] = slot.endTime.split(':').map(Number);
                                                const durMin = (eh * 60 + em) - (sh * 60 + sm);

                                                return (
                                                    <tr key={slot.id} className="hover:bg-blue-50/40 transition-colors group">
                                                        <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                Jam ke-{slot.slotNumber}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{slot.startTime}</td>
                                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{slot.endTime}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">{durMin} menit</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => openEditSlot(slot)}
                                                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteSlot(slot)}
                                                                    disabled={deleteSlotMutation.isPending}
                                                                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Hapus"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Info box */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-blue-700">
                                    <p className="font-medium">Perubahan jam pelajaran bersifat global</p>
                                    <p className="mt-0.5 text-blue-600">
                                        Mengubah atau menghapus jam akan mempengaruhi semua kelas di halaman Manajemen Jadwal.
                                        Gunakan tombol "Refresh Jadwal Grids" setelah perubahan.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ─── Tab 5: Manajemen Libur ─── */}
                    <TabsContent value="holidays" className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <CalendarOff className="w-5 h-5 text-red-500" />
                                        Manajemen Libur
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Kelola hari libur, rapat guru, dan acara sekolah
                                    </p>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                                    >
                                        <Download className="w-4 h-4" />
                                        Template Excel
                                    </button>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={importHolidaysMutation.isPending}
                                        className="flex items-center gap-2 px-3 py-2 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors text-sm font-medium disabled:opacity-50"
                                    >
                                        {importHolidaysMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        Import Excel
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleImportExcel}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={openAddHoliday}
                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:from-red-600 hover:to-rose-700 transition-all text-sm font-medium shadow-sm"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Tambah Libur
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            {holidaysLoading ? (
                                <div className="text-center py-12">
                                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-red-500" />
                                    <p className="text-gray-500 text-sm mt-2">Memuat data...</p>
                                </div>
                            ) : holidays.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                                    <CalendarOff className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                                    <p className="text-gray-500">Belum ada data libur</p>
                                    <button
                                        onClick={openAddHoliday}
                                        className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                                    >
                                        + Tambah Libur Pertama
                                    </button>
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">No</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Alasan</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipe</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kelas</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {holidays.map((h, idx) => {
                                                const typeInfo = HOLIDAY_TYPE_LABELS[h.type] || { label: h.type, color: 'bg-gray-100 text-gray-700' };
                                                return (
                                                    <tr key={h.id} className="hover:bg-red-50/40 transition-colors group">
                                                        <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900">
                                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                                {new Date(h.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-900">{h.reason}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${typeInfo.color}`}>
                                                                {typeInfo.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">
                                                            {h.class ? h.class.name : <span className="text-gray-400 italic">Semua</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => openEditHoliday(h)}
                                                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteHoliday(h)}
                                                                    disabled={deleteHolidayMutation.isPending}
                                                                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Hapus"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Info box */}
                            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-red-700">
                                    <p className="font-medium">Hari libur memblokir presensi</p>
                                    <p className="mt-0.5 text-red-600">
                                        Pada hari libur, scan presensi akan ditolak dan menampilkan alasan libur. Libur bersifat global kecuali kelas tertentu dipilih.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ─── Tab 4: Geofence ─── */}
                    <TabsContent value="geofence" className="bg-white p-6 rounded-xl shadow-sm">
                        <GeofenceTab />
                    </TabsContent>

                    {/* ─── Tab 6: Backup Data ─── */}
                    <TabsContent value="backup" className="bg-white p-6 rounded-xl shadow-sm">
                        <BackupTab />
                    </TabsContent>

                    {/* ─── Tab 7: Data Cleanup ─── */}
                    <TabsContent value="cleanup" className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex items-start gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                                <ShieldAlert className="w-8 h-8 text-red-600 flex-shrink-0" />
                                <div>
                                    <h2 className="text-lg font-semibold text-red-800">Danger Zone: Data Cleanup</h2>
                                    <p className="text-sm text-red-700 mt-1">
                                        Hapus data rekap presensi guru dan siswa. <br />
                                        <strong>⚠️ Data yang dihapus TIDAK BISA DIKEMBALIKAN!</strong>
                                    </p>
                                </div>
                            </div>

                            {/* Cleanup Options */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Option 1: Delete by Range */}
                                <div className="border-2 border-gray-200 rounded-xl p-6 hover:border-orange-300 transition-colors">
                                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-orange-600" />
                                        Hapus Periode Tertentu
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                                            <input
                                                type="date"
                                                value={cleanupStartDate}
                                                onChange={(e) => setCleanupStartDate(e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Akhir</label>
                                            <input
                                                type="date"
                                                value={cleanupEndDate}
                                                onChange={(e) => setCleanupEndDate(e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (!cleanupStartDate || !cleanupEndDate) {
                                                    alert('Pilih tanggal mulai dan akhir terlebih dahulu');
                                                    return;
                                                }
                                                setCleanupType('range');
                                                setShowCleanupConfirm(true);
                                            }}
                                            disabled={!cleanupStartDate || !cleanupEndDate}
                                            className="w-full px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Hapus Periode {cleanupStartDate && cleanupEndDate ? `(${cleanupStartDate} - ${cleanupEndDate})` : ''}
                                        </button>
                                    </div>
                                </div>

                                {/* Option 2: Delete All */}
                                <div className="border-2 border-red-200 rounded-xl p-6 bg-red-50/30">
                                    <h3 className="font-semibold text-red-800 mb-4 flex items-center gap-2">
                                        <Database className="w-5 h-5 text-red-600" />
                                        Hapus SEMUA Data Rekap
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="text-sm text-red-700 space-y-2">
                                            <p>Menghapus:</p>
                                            <ul className="list-disc pl-5 space-y-1">
                                                <li>Semua presensi guru</li>
                                                <li>Semua presensi siswa</li>
                                                <li>Semua sesi kelas</li>
                                            </ul>
                                            <p className="font-semibold mt-3">
                                                ❌ User, Kelas, Jadwal, Schedule TIDAK akan dihapus.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setCleanupType('all');
                                                setShowCleanupConfirm(true);
                                            }}
                                            className="w-full px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            ⚠️ Hapus SEMUA Rekap
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-blue-700">
                                    <p className="font-medium">Catatan:</p>
                                    <ul className="mt-1 space-y-1 list-disc pl-4">
                                        <li>Backup data sebelum menghapus (export ke Excel via menu Rekap)</li>
                                        <li>Penghapusan dicatat di audit log</li>
                                        <li>Fitur ini hanya tersedia untuk Admin</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* ─── Time Slot Modal ─── */}
            {showSlotModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingSlot ? `Edit Jam ke-${editingSlot.slotNumber}` : 'Tambah Jam Pelajaran'}
                            </h2>
                            <button
                                onClick={closeSlotModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSlotSubmit} className="p-6 space-y-5">
                            {slotError && (
                                <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    {slotError}
                                </div>
                            )}

                            {/* Slot number */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jam ke-</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={MAX_SLOTS}
                                    value={slotForm.slotNumber}
                                    onChange={e => setSlotForm({ ...slotForm, slotNumber: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                    placeholder="1"
                                    required
                                />
                            </div>

                            {/* Time pickers */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Jam Mulai</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                                        <input
                                            type="time"
                                            value={slotForm.startTime}
                                            onChange={e => setSlotForm({ ...slotForm, startTime: e.target.value })}
                                            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Jam Selesai</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                                        <input
                                            type="time"
                                            value={slotForm.endTime}
                                            onChange={e => setSlotForm({ ...slotForm, endTime: e.target.value })}
                                            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Duration preview */}
                            {slotForm.startTime && slotForm.endTime && slotForm.endTime > slotForm.startTime && (
                                <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <span className="text-sm text-gray-600">
                                        Durasi: <strong className="text-gray-900">
                                            {(() => {
                                                const [sh, sm] = slotForm.startTime.split(':').map(Number);
                                                const [eh, em] = slotForm.endTime.split(':').map(Number);
                                                return (eh * 60 + em) - (sh * 60 + sm);
                                            })()}
                                        </strong> menit
                                    </span>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeSlotModal}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isMutating}
                                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isMutating && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingSlot ? 'Simpan Perubahan' : 'Tambah Jam'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Holiday Modal ─── */}
            {showHolidayModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingHoliday ? 'Edit Libur' : 'Tambah Libur'}
                            </h2>
                            <button
                                onClick={closeHolidayModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleHolidaySubmit} className="p-6 space-y-5">
                            {holidayError && (
                                <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    {holidayError}
                                </div>
                            )}

                            {/* Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                                <input
                                    type="date"
                                    value={holidayForm.date}
                                    onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm"
                                    required
                                />
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alasan</label>
                                <input
                                    type="text"
                                    value={holidayForm.reason}
                                    onChange={e => setHolidayForm({ ...holidayForm, reason: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm"
                                    placeholder="e.g. Maulid Nabi Muhammad SAW"
                                    required
                                />
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                                <select
                                    value={holidayForm.type}
                                    onChange={e => setHolidayForm({ ...holidayForm, type: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm bg-white"
                                >
                                    <option value="national">🇮🇩 Libur Nasional</option>
                                    <option value="school">🏫 Libur Sekolah</option>
                                    <option value="meeting">👥 Rapat Guru</option>
                                </select>
                            </div>

                            {/* Class (optional) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kelas <span className="text-gray-400 font-normal">(opsional, kosongkan = semua)</span></label>
                                <select
                                    value={holidayForm.classId}
                                    onChange={e => setHolidayForm({ ...holidayForm, classId: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm bg-white"
                                >
                                    <option value="">Semua Kelas</option>
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeHolidayModal}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isHolidayMutating}
                                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl hover:from-red-600 hover:to-rose-700 transition-all font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isHolidayMutating && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingHoliday ? 'Simpan Perubahan' : 'Tambah Libur'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Geofence Tab Content (injected as separate component below) ─── */}

            {/* ─── Cleanup Confirm Modal ─── */}
            {showCleanupConfirm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCleanupConfirm(false)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-red-600 px-6 py-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5" /> Konfirmasi Hapus Data
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <p className="text-red-800 font-medium">⚠️ PERHATIAN: Aksi ini TIDAK BISA DIBATALKAN!</p>
                                <p className="text-red-700 text-sm mt-2">
                                    {cleanupType === 'all'
                                        ? 'Semua data rekap presensi (guru & siswa) akan dihapus PERMANEN.'
                                        : `Data rekap dari ${cleanupStartDate} s/d ${cleanupEndDate} akan dihapus PERMANEN.`
                                    }
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Ketik <span className="font-bold text-red-600">HAPUS DATA</span> untuk konfirmasi:
                                </label>
                                <input
                                    type="text"
                                    value={cleanupConfirmText}
                                    onChange={(e) => setCleanupConfirmText(e.target.value)}
                                    placeholder="HAPUS DATA"
                                    className="w-full px-4 py-3 border-2 border-red-300 rounded-xl text-center font-mono text-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowCleanupConfirm(false); setCleanupConfirmText(''); }}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => {
                                        cleanupMutation.mutate({
                                            type: cleanupType,
                                            startDate: cleanupType === 'range' ? cleanupStartDate : undefined,
                                            endDate: cleanupType === 'range' ? cleanupEndDate : undefined,
                                            confirmText: cleanupConfirmText,
                                        });
                                    }}
                                    disabled={cleanupConfirmText !== 'HAPUS DATA' || cleanupMutation.isPending}
                                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {cleanupMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Hapus Permanen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel={confirmState.confirmLabel}
                variant={confirmState.variant}
                onConfirm={confirmState.onConfirm}
                onCancel={closeConfirm}
            />
        </div>
    );
};

export default Settings;
