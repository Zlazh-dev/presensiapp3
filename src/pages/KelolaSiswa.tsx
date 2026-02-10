import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import api from '../lib/api';
import {
    ArrowLeft, Plus, Edit2, Trash2, Search, X, Users,
    Download, Upload, Loader2, CheckCircle, AlertCircle, Save,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

interface Student {
    id: number;
    nis: string;
    name: string;
    gender: 'M' | 'F' | null;
    classId: number;
}

interface FormData {
    nis: string;
    name: string;
    gender: string;
}

const emptyForm: FormData = { nis: '', name: '', gender: 'M' };

const KelolaSiswa: React.FC = () => {
    const { id: classId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // State
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<FormData>(emptyForm);
    const [importResult, setImportResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null });

    // Fetch students
    const { data, isLoading, error } = useQuery({
        queryKey: ['class-students', classId],
        queryFn: async () => {
            const res = await api.get(`/classes/${classId}/students`);
            return res.data;
        },
        enabled: !!classId,
    });

    const students: Student[] = data?.students || [];
    const className = data?.className || '';

    // Filtered
    const filtered = useMemo(() => {
        if (!search) return students;
        const s = search.toLowerCase();
        return students.filter(
            (st) => st.name.toLowerCase().includes(s) || st.nis.includes(s)
        );
    }, [students, search]);

    // Add student mutation
    const addMutation = useMutation({
        mutationFn: (data: FormData) =>
            api.post(`/classes/${classId}/students`, {
                nis: data.nis,
                name: data.name,
                gender: data.gender,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-students', classId] });
            setShowForm(false);
            setFormData(emptyForm);
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || 'Gagal menambahkan siswa');
        },
    });

    // Update student mutation
    const updateMutation = useMutation({
        mutationFn: ({ studentId, data }: { studentId: number; data: FormData }) =>
            api.put(`/classes/${classId}/students/${studentId}`, {
                nis: data.nis,
                name: data.name,
                gender: data.gender,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-students', classId] });
            setEditingId(null);
            setFormData(emptyForm);
            setShowForm(false);
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || 'Gagal memperbarui siswa');
        },
    });

    // Delete student mutation
    const deleteMutation = useMutation({
        mutationFn: (studentId: number) =>
            api.delete(`/classes/${classId}/students/${studentId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-students', classId] });
        },
    });

    // Import mutation
    const importMutation = useMutation({
        mutationFn: async (file: File) => {
            const fd = new FormData();
            fd.append('file', file);
            return api.post(`/classes/${classId}/students-import`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['class-students', classId] });
            setImportResult({ message: res.data.message, type: 'success' });
            setTimeout(() => setImportResult(null), 5000);
        },
        onError: (err: any) => {
            setImportResult({ message: err.response?.data?.error || 'Import gagal', type: 'error' });
            setTimeout(() => setImportResult(null), 5000);
        },
    });

    // Download template XLSX
    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['NISN', 'Nama', 'JK'],
            ['2025001', 'Nama Siswa', 'L'],
        ]);
        ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 5 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, `Template_Import_Siswa_Kelas_${className || classId}.xlsx`);
    };

    // Handle file upload
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            importMutation.mutate(file);
            e.target.value = ''; // Reset
        }
    };

    // Handle form submit
    const handleSubmit = () => {
        if (!formData.nis || !formData.name) return;
        if (editingId) {
            updateMutation.mutate({ studentId: editingId, data: formData });
        } else {
            addMutation.mutate(formData);
        }
    };

    // Edit handler
    const handleEdit = (student: Student) => {
        setEditingId(student.id);
        setFormData({
            nis: student.nis,
            name: student.name,
            gender: student.gender === 'M' ? 'L' : student.gender === 'F' ? 'P' : 'L',
        });
        setShowForm(true);
    };

    // Delete handler
    const handleDelete = (student: Student) => {
        setDeleteConfirm({ open: true, student });
    };

    const handleDeleteConfirm = () => {
        if (deleteConfirm.student) {
            deleteMutation.mutate(deleteConfirm.student.id);
        }
        setDeleteConfirm({ open: false, student: null });
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData(emptyForm);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16 text-red-600">
                <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                <p>Gagal memuat data siswa</p>
                <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:underline">← Kembali</button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/manajemen-kelas')}
                        className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Users className="w-7 h-7 text-blue-600" />
                            Siswa Kelas {className}
                        </h1>
                        <p className="text-gray-500 mt-0.5">{students.length} siswa terdaftar</p>
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {/* Download Template */}
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Template
                    </button>

                    {/* Import Excel */}
                    <label className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Import Excel
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                    </label>

                    {/* Add Student */}
                    <button
                        onClick={() => { setShowForm(true); setEditingId(null); setFormData(emptyForm); }}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Tambah Siswa
                    </button>
                </div>
            </div>

            {/* Import Result Banner */}
            {importResult && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${importResult.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {importResult.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {importResult.message}
                </div>
            )}

            {/* Import spinner */}
            {importMutation.isPending && (
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-200">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengimpor data siswa...
                </div>
            )}

            {/* Add/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingId ? 'Edit Siswa' : 'Tambah Siswa Baru'}
                            </h2>
                            <button onClick={cancelForm} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">NISN</label>
                                <input
                                    type="text"
                                    placeholder="2025001"
                                    value={formData.nis}
                                    onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                                <input
                                    type="text"
                                    placeholder="Nama siswa"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Kelamin</label>
                                <select
                                    value={formData.gender}
                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                >
                                    <option value="L">Laki-laki</option>
                                    <option value="P">Perempuan</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={cancelForm}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!formData.nis || !formData.name || addMutation.isPending || updateMutation.isPending}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                                >
                                    <Save className="w-4 h-4" />
                                    {addMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Cari NISN atau nama..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white shadow-sm"
                />
            </div>

            {/* Student Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-left">
                                <th className="px-4 py-3 font-semibold text-gray-600 w-12">#</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 w-36">NISN</th>
                                <th className="px-4 py-3 font-semibold text-gray-600">Nama</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 w-24">JK</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 w-20 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map((student, idx) => (
                                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                                    <td className="px-4 py-3 font-mono text-gray-700">{student.nis}</td>
                                    <td className="px-4 py-3 font-medium text-gray-900">{student.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${student.gender === 'M'
                                            ? 'bg-blue-100 text-blue-700'
                                            : student.gender === 'F'
                                                ? 'bg-pink-100 text-pink-700'
                                                : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {student.gender === 'M' ? 'Laki-laki' : student.gender === 'F' ? 'Perempuan' : '-'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => handleEdit(student)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(student)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Hapus"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filtered.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <Users className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                        <p>{search ? 'Tidak ada siswa yang cocok' : 'Belum ada siswa di kelas ini'}</p>
                    </div>
                )}
            </div>

            <ConfirmModal
                open={deleteConfirm.open}
                title="Hapus Siswa?"
                message={`Siswa "${deleteConfirm.student?.name || ''}" akan dihapus dari kelas ini.`}
                confirmLabel="Hapus"
                variant="danger"
                loading={deleteMutation.isPending}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirm({ open: false, student: null })}
            />
        </div>
    );
};

export default KelolaSiswa;
