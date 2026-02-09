import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Calendar, Download, Upload, Printer, Check, X, Loader2,
    ChevronDown, Grid3X3, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────
interface TimeSlot {
    id: number;
    slotNumber: number;
    startTime: string;
    endTime: string;
}

interface ClassItem {
    id: number;
    name: string;
    level: number;
}

interface SubjectItem {
    id: number;
    name: string;
    code: string;
}

interface TeacherItem {
    id: number;
    userId: number;
    user?: { name: string };
}

interface SlotData {
    scheduleId: number;
    subjectId: number;
    subject: string;
    subjectCode: string;
    teacherId: number;
    teacher: string;
}

interface GridRow {
    day: string;
    dayNumber: number;
    slots: (SlotData | null)[];
}

interface CellCoord {
    dayIndex: number;
    slotIndex: number;
}

// ─── API helpers ──────────────────────────────────────────────
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

// ─── Component ────────────────────────────────────────────────
const Jadwal: React.FC = () => {
    const queryClient = useQueryClient();

    // ── State ──
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [editingCell, setEditingCell] = useState<CellCoord | null>(null);
    const [editSubjectId, setEditSubjectId] = useState<string>('');
    const [editTeacherId, setEditTeacherId] = useState<string>('');
    const [selectedCells, setSelectedCells] = useState<CellCoord[]>([]);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkSubjectId, setBulkSubjectId] = useState('');
    const [bulkTeacherId, setBulkTeacherId] = useState('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Queries ──
    const { data: classesData } = useQuery({
        queryKey: ['classes'],
        queryFn: () => fetchJSON(`${API}/classes`),
    });

    const { data: timeSlotsData } = useQuery({
        queryKey: ['timeSlots'],
        queryFn: () => fetchJSON(`${API}/time-slots`),
    });

    const { data: subjectsData } = useQuery({
        queryKey: ['subjects'],
        queryFn: () => fetchJSON(`${API}/subjects`),
    });

    const { data: teachersData } = useQuery({
        queryKey: ['teachers'],
        queryFn: () => fetchJSON(`${API}/teachers`),
    });

    const { data: gridData, isLoading: gridLoading, isFetching: gridFetching } = useQuery({
        queryKey: ['scheduleGrid', selectedClassId],
        queryFn: () => fetchJSON(`${API}/schedules/${selectedClassId}/grid`),
        enabled: !!selectedClassId,
    });

    const classes: ClassItem[] = classesData?.classes || [];
    const timeSlots: TimeSlot[] = timeSlotsData?.timeSlots || [];
    const subjects: SubjectItem[] = subjectsData?.subjects || [];
    const teachers: TeacherItem[] = teachersData?.teachers || [];
    const grid: GridRow[] = gridData?.grid || [];

    // Auto-select first class
    useEffect(() => {
        if (classes.length > 0 && selectedClassId === null) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes, selectedClassId]);

    // ── Mutations ──
    const bulkMutation = useMutation({
        mutationFn: async (assignments: any[]) => {
            const res = await fetch(`${API}/schedules/${selectedClassId}/bulk`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ assignments }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Bulk assign failed');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scheduleGrid', selectedClassId] });
            setEditingCell(null);
            setSelectedCells([]);
            setShowBulkModal(false);
        },
    });

    // ── Cell click handler ──
    const handleCellClick = useCallback(
        (dayIndex: number, slotIndex: number, e: React.MouseEvent) => {
            const coord: CellCoord = { dayIndex, slotIndex };

            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                // Multi-select mode
                setSelectedCells(prev => {
                    const exists = prev.find(c => c.dayIndex === dayIndex && c.slotIndex === slotIndex);
                    if (exists) return prev.filter(c => !(c.dayIndex === dayIndex && c.slotIndex === slotIndex));
                    return [...prev, coord];
                });
                setEditingCell(null);
            } else {
                // Single cell edit
                setEditingCell(coord);
                setSelectedCells([]);
                setEditSubjectId('');
                setEditTeacherId('');
            }
        }, []
    );

    // ── Save single cell ──
    const handleSaveCell = useCallback(() => {
        if (!editingCell || !editSubjectId || !editTeacherId) return;

        const row = grid[editingCell.dayIndex];
        if (!row) return;

        bulkMutation.mutate([{
            day: row.day,
            slotId: timeSlots[editingCell.slotIndex]?.slotNumber,
            subjectId: Number(editSubjectId),
            teacherId: Number(editTeacherId),
        }]);
    }, [editingCell, editSubjectId, editTeacherId, grid, timeSlots, bulkMutation]);

    // ── Bulk assign ──
    const handleBulkAssign = useCallback(() => {
        if (!bulkSubjectId || !bulkTeacherId || selectedCells.length === 0) return;

        const assignments = selectedCells.map(cell => ({
            day: grid[cell.dayIndex]?.day,
            slotId: timeSlots[cell.slotIndex]?.slotNumber,
            subjectId: Number(bulkSubjectId),
            teacherId: Number(bulkTeacherId),
        }));

        bulkMutation.mutate(assignments);
    }, [bulkSubjectId, bulkTeacherId, selectedCells, grid, timeSlots, bulkMutation]);

    // ── Download template ──
    const handleDownloadTemplate = useCallback(async () => {
        if (!selectedClassId) return;
        try {
            const res = await fetch(`${API}/schedules/${selectedClassId}/export-template`, {
                method: 'POST',
                headers: getHeaders(),
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `jadwal_template.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download template error:', err);
            alert('Gagal download template');
        }
    }, [selectedClassId]);

    // ── Import XLSX ──
    const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedClassId) return;

        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${API}/schedules/${selectedClassId}/import`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) {
                alert(`Import gagal: ${data.error}\n${(data.details || []).join('\n')}`);
            } else {
                alert(`Berhasil import ${data.count} jadwal`);
                queryClient.invalidateQueries({ queryKey: ['scheduleGrid', selectedClassId] });
            }
        } catch (err) {
            console.error('Import error:', err);
            alert('Gagal import jadwal');
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [selectedClassId, queryClient]);

    // ── Print ──
    const handlePrint = useCallback(() => window.print(), []);

    // ── Check if cell is selected ──
    const isCellSelected = (dayIndex: number, slotIndex: number) =>
        selectedCells.some(c => c.dayIndex === dayIndex && c.slotIndex === slotIndex);

    // ── Day gradient colors ──
    const dayColors: Record<string, string> = {
        Senin: 'bg-blue-50 text-blue-800',
        Selasa: 'bg-emerald-50 text-emerald-800',
        Rabu: 'bg-amber-50 text-amber-800',
        Kamis: 'bg-purple-50 text-purple-800',
        Jumat: 'bg-rose-50 text-rose-800',
        Sabtu: 'bg-cyan-50 text-cyan-800',
    };

    const dayBorderColors: Record<string, string> = {
        Senin: 'border-l-blue-500',
        Selasa: 'border-l-emerald-500',
        Rabu: 'border-l-amber-500',
        Kamis: 'border-l-purple-500',
        Jumat: 'border-l-rose-500',
        Sabtu: 'border-l-cyan-500',
    };

    return (
        <div className="space-y-6 print:space-y-2">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Grid3X3 className="w-7 h-7 text-blue-600" />
                        Manajemen Jadwal
                    </h1>
                    <p className="text-gray-500 mt-1">Kelola jadwal pelajaran per kelas — klik sel untuk mengisi</p>
                </div>
                <div className="flex items-center gap-2">
                    {selectedCells.length > 0 && (
                        <button
                            onClick={() => setShowBulkModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all text-sm font-medium shadow-sm"
                        >
                            <Check className="w-4 h-4" />
                            Isi Mapel ({selectedCells.length} sel)
                        </button>
                    )}
                    <button
                        onClick={handleDownloadTemplate}
                        disabled={!selectedClassId}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        Download Template
                    </button>
                    <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer">
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Import Jadwal
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleImport}
                            disabled={!selectedClassId || importing}
                        />
                    </label>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                        <Printer className="w-4 h-4" />
                        Print
                    </button>
                </div>
            </div>

            {/* ── Print Header ── */}
            <div className="hidden print:block text-center mb-4">
                <h1 className="text-xl font-bold">
                    Jadwal Pelajaran — Kelas {classes.find(c => c.id === selectedClassId)?.name}
                </h1>
            </div>

            {/* ── Class Tabs ── */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl print:hidden">
                {classes.map(cls => (
                    <button
                        key={cls.id}
                        onClick={() => {
                            setSelectedClassId(cls.id);
                            setEditingCell(null);
                            setSelectedCells([]);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedClassId === cls.id
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {cls.name}
                    </button>
                ))}
            </div>

            {/* ── Grid ── */}
            {!selectedClassId ? (
                <div className="text-center py-16 text-gray-400">
                    <Calendar className="w-16 h-16 mx-auto mb-3 opacity-50" />
                    <p className="text-lg">Pilih kelas untuk melihat jadwal</p>
                </div>
            ) : gridLoading ? (
                <div className="text-center py-16">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
                    <p className="text-gray-500 mt-2">Memuat jadwal...</p>
                </div>
            ) : (
                <div className="relative">
                    {gridFetching && (
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" /> Memperbarui...
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24 sticky left-0 bg-gray-50 z-10">
                                            Hari
                                        </th>
                                        {timeSlots.map(ts => (
                                            <th
                                                key={ts.id}
                                                className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-l border-gray-200 min-w-[160px]"
                                            >
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] text-gray-400">Jam ke-{ts.slotNumber}</span>
                                                    <span>{ts.startTime} – {ts.endTime}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {grid.map((row, dayIndex) => (
                                        <tr
                                            key={row.day}
                                            className="hover:bg-gray-50/50 transition-colors group"
                                        >
                                            <td className={`px-4 py-3 font-semibold text-sm border-b border-l-4 ${dayBorderColors[row.day] || ''} ${dayColors[row.day] || ''} sticky left-0 z-10`}>
                                                {row.day}
                                            </td>
                                            {row.slots.map((slot, slotIndex) => {
                                                const isEditing = editingCell?.dayIndex === dayIndex && editingCell?.slotIndex === slotIndex;
                                                const isSelected = isCellSelected(dayIndex, slotIndex);

                                                return (
                                                    <td
                                                        key={slotIndex}
                                                        onClick={(e) => handleCellClick(dayIndex, slotIndex, e)}
                                                        className={`px-2 py-2 border-b border-l border-gray-200 cursor-pointer transition-all duration-150 print:cursor-default
                                                            ${isEditing ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''}
                                                            ${isSelected ? 'bg-indigo-100 ring-2 ring-indigo-400 ring-inset' : ''}
                                                            ${!isEditing && !isSelected && !slot ? 'hover:bg-blue-50/50' : ''}
                                                            ${!isEditing && !isSelected && slot ? 'hover:bg-gray-50' : ''}
                                                        `}
                                                    >
                                                        {isEditing ? (
                                                            /* Inline edit form */
                                                            <div className="space-y-1.5 min-w-[150px] print:hidden" onClick={e => e.stopPropagation()}>
                                                                <select
                                                                    value={editSubjectId}
                                                                    onChange={e => setEditSubjectId(e.target.value)}
                                                                    className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                                                                    autoFocus
                                                                >
                                                                    <option value="">Pilih Mapel</option>
                                                                    {subjects.map(s => (
                                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                                    ))}
                                                                </select>
                                                                <select
                                                                    value={editTeacherId}
                                                                    onChange={e => setEditTeacherId(e.target.value)}
                                                                    className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                                                                >
                                                                    <option value="">Pilih Guru</option>
                                                                    {teachers.map(t => (
                                                                        <option key={t.id} value={t.id}>{t.user?.name}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={handleSaveCell}
                                                                        disabled={!editSubjectId || !editTeacherId || bulkMutation.isPending}
                                                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                                                    >
                                                                        {bulkMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                                        Simpan
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setEditingCell(null); }}
                                                                        className="px-2 py-1 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : slot ? (
                                                            /* Filled cell */
                                                            <div className="min-w-[120px]">
                                                                <div className="text-sm font-semibold text-gray-900">{slot.subject}</div>
                                                                <div className="text-xs text-gray-500 mt-0.5">{slot.teacher}</div>
                                                            </div>
                                                        ) : (
                                                            /* Empty cell */
                                                            <div className="min-w-[120px] h-10 flex items-center justify-center print:hidden">
                                                                <span className="text-xs text-gray-300 group-hover:text-gray-400 transition-colors">
                                                                    + Klik untuk isi
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Hint bar ── */}
                    <div className="flex items-center gap-4 text-xs text-gray-400 mt-3 print:hidden">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Click</kbd>
                            Edit sel
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl</kbd>+
                            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Click</kbd>
                            Multi-select
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Shift</kbd>+
                            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Click</kbd>
                            Multi-select
                        </span>
                    </div>
                </div>
            )}

            {/* ── Bulk Assign Modal ── */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Isi Mapel Bulk</h2>
                                <p className="text-sm text-gray-500">{selectedCells.length} sel terpilih</p>
                            </div>
                            <button
                                onClick={() => setShowBulkModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mata Pelajaran</label>
                                <select
                                    value={bulkSubjectId}
                                    onChange={e => setBulkSubjectId(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                                >
                                    <option value="">Pilih Mata Pelajaran</option>
                                    {subjects.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Guru</label>
                                <select
                                    value={bulkTeacherId}
                                    onChange={e => setBulkTeacherId(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                                >
                                    <option value="">Pilih Guru</option>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.id}>{t.user?.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Selected cells preview */}
                            <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-xs font-medium text-gray-500 mb-2">Sel yang akan diisi:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedCells.map((cell, i) => (
                                        <span key={i} className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                                            {grid[cell.dayIndex]?.day} / Jam {timeSlots[cell.slotIndex]?.slotNumber}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowBulkModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleBulkAssign}
                                    disabled={!bulkSubjectId || !bulkTeacherId || bulkMutation.isPending}
                                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {bulkMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Simpan {selectedCells.length} Jadwal
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print-only styles */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .space-y-6, .space-y-6 * { visibility: visible; }
                    .space-y-6 { position: absolute; left: 0; top: 0; width: 100%; }
                    .print\\:hidden { display: none !important; }
                    .print\\:block { display: block !important; }
                    table { font-size: 11px; }
                    td, th { padding: 4px 8px !important; }
                }
            `}</style>
        </div>
    );
};

export default Jadwal;
