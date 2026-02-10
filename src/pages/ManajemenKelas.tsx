import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Search, X, GraduationCap, QrCode, Download, Printer, Users } from 'lucide-react';
import api from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';

interface ClassItem {
    id: number;
    name: string;
    level: number;
    homeroomTeacher?: string;
    academicYear?: string;
    studentCount?: number;
}

const levelColors: Record<number, string> = {
    7: 'from-blue-500 to-blue-600',
    8: 'from-emerald-500 to-emerald-600',
    9: 'from-purple-500 to-purple-600',
};

const ManajemenKelas: React.FC = () => {
    const navigate = useNavigate();
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', level: 7 });
    const [loading, setLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null; name: string }>({ open: false, id: null, name: '' });

    // QR Modal State
    const [qrModal, setQrModal] = useState<{ open: boolean; cls: ClassItem | null; qrPng: string; qrSvg: string }>({
        open: false, cls: null, qrPng: '', qrSvg: '',
    });

    // Fetch classes from API
    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await api.get('/classes');
            setClasses(res.data.classes || []);
        } catch (err) {
            console.error('Failed to fetch classes', err);
            // Fallback to mock data if API fails
            setClasses([
                { id: 1, name: '7A', level: 7, homeroomTeacher: 'Guru Pertama', academicYear: '2025/2026' },
                { id: 2, name: '7B', level: 7, homeroomTeacher: 'Siti Nurhaliza', academicYear: '2025/2026' },
                { id: 3, name: '8A', level: 8, homeroomTeacher: 'Ahmad Rahman', academicYear: '2025/2026' },
                { id: 4, name: '8B', level: 8, homeroomTeacher: 'Dewi Kusuma', academicYear: '2025/2026' },
                { id: 5, name: '9A', level: 9, homeroomTeacher: 'Rudi Hermawan', academicYear: '2025/2026' },
                { id: 6, name: '9B', level: 9, homeroomTeacher: 'Budi Santoso', academicYear: '2025/2026' },
            ]);
        }
    };

    const filteredClasses = classes.filter(
        (c) => c.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleDeleteClick = (cls: ClassItem) => {
        setDeleteConfirm({ open: true, id: cls.id, name: cls.name });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm.id) return;
        try {
            await api.delete(`/classes/${deleteConfirm.id}`);
            setClasses(classes.filter((c) => c.id !== deleteConfirm.id));
        } catch (err) {
            alert('Gagal menghapus kelas');
        } finally {
            setDeleteConfirm({ open: false, id: null, name: '' });
        }
    };

    const handleSave = async () => {
        if (!formData.name) return;
        setLoading(true);
        try {
            const res = await api.post('/classes', { name: formData.name, level: formData.level });
            const newClass = res.data.class;
            setClasses([...classes, newClass]);
            setShowAddModal(false);
            setFormData({ name: '', level: 7 });
        } catch (err) {
            alert('Gagal menambahkan kelas');
        } finally {
            setLoading(false);
        }
    };

    // Open QR modal for a class
    const handleShowQR = async (cls: ClassItem) => {
        try {
            // Use the new persistent QR endpoint
            // Try to view first, if 404 then generate? 
            // Or just generate (upsert) to ensure it exists.
            const res = await api.post(`/qr/class/${cls.id}/generate`);
            setQrModal({
                open: true,
                cls,
                qrPng: res.data.qrCode,
                qrSvg: '' // SVG not supported in new controller yet, or we can add it later if needed
            });
        } catch (err) {
            console.error(err);
            alert('Gagal memuat QR code');
        }
    };

    // Download QR as PNG
    const handleDownloadPNG = () => {
        if (!qrModal.qrPng || !qrModal.cls) return;
        const link = document.createElement('a');
        link.href = qrModal.qrPng;
        link.download = `QR-Kelas-${qrModal.cls.name}.png`;
        link.click();
    };

    // Download QR as SVG
    const handleDownloadSVG = () => {
        if (!qrModal.qrSvg || !qrModal.cls) return;
        const blob = new Blob([qrModal.qrSvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `QR-Kelas-${qrModal.cls.name}.svg`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Print QR
    const handlePrint = () => {
        if (!qrModal.qrPng || !qrModal.cls) return;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`
      <html>
        <head><title>QR Kelas ${qrModal.cls.name}</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;">
          <h2 style="margin-bottom:8px;">Kelas ${qrModal.cls.name}</h2>
          <p style="color:#666;margin-bottom:24px;">Scan untuk presensi</p>
          <img src="${qrModal.qrPng}" style="width:300px;height:300px;" />
        </body>
      </html>
    `);
        w.document.close();
        w.print();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <GraduationCap className="w-7 h-7 text-indigo-600" />
                        Manajemen Kelas
                    </h1>
                    <p className="text-gray-500 mt-1">Kelola data kelas & cetak QR Code</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all text-sm font-medium shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Tambah Kelas
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Cari kelas..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm bg-white shadow-sm"
                />
            </div>

            {/* Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredClasses.map((cls) => (
                    <div
                        key={cls.id}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden group"
                    >
                        {/* Level Header */}
                        <div className={`bg-gradient-to-r ${levelColors[cls.level] || 'from-gray-500 to-gray-600'} px-4 py-3`}>
                            <div className="flex items-center justify-between">
                                <span className="text-white text-xl font-bold">Kelas {cls.name}</span>
                                <span className="text-white/80 text-sm">Tingkat {cls.level}</span>
                            </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 space-y-3">
                            {/* Homeroom Teacher */}
                            {cls.homeroomTeacher && (
                                <div>
                                    <p className="text-xs text-gray-400 mb-1">Wali Kelas</p>
                                    <p className="text-sm font-medium text-gray-700">{cls.homeroomTeacher}</p>
                                </div>
                            )}

                            {/* Academic Year */}
                            {cls.academicYear && (
                                <div>
                                    <p className="text-xs text-gray-400 mb-1">Tahun Ajaran</p>
                                    <p className="text-sm text-gray-600">{cls.academicYear}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    {/* QR Button */}
                                    <button
                                        onClick={() => handleShowQR(cls)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                    >
                                        <QrCode className="w-4 h-4" />
                                        QR
                                    </button>

                                    {/* Kelola Siswa Button */}
                                    <button
                                        onClick={() => navigate(`/kelas/${cls.id}/siswa`)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                    >
                                        <Users className="w-4 h-4" />
                                        Siswa{cls.studentCount != null ? ` (${cls.studentCount})` : ''}
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(cls)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Hapus"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredClasses.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <GraduationCap className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p>Tidak ada kelas yang ditemukan</p>
                </div>
            )}

            {/* Add Class Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">Tambah Kelas Baru</h2>
                            <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kelas</label>
                                <input
                                    type="text"
                                    placeholder="7A"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tingkat</label>
                                <select
                                    value={formData.level}
                                    onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                >
                                    <option value={7}>7</option>
                                    <option value={8}>8</option>
                                    <option value={9}>9</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!formData.name || loading}
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Preview Modal */}
            {qrModal.open && qrModal.cls && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">QR Code — Kelas {qrModal.cls.name}</h2>
                            <button
                                onClick={() => setQrModal({ open: false, cls: null, qrPng: '', qrSvg: '' })}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col items-center space-y-4">
                            {/* QR Image */}
                            {qrModal.qrPng ? (
                                <img src={qrModal.qrPng} alt={`QR Kelas ${qrModal.cls.name}`} className="w-64 h-64 rounded-lg border border-gray-200" />
                            ) : (
                                <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                    Loading...
                                </div>
                            )}

                            <p className="text-sm text-gray-500">Tempel di kelas untuk scan presensi guru</p>

                            {/* Action Buttons */}
                            <div className="flex gap-2 w-full">
                                <button
                                    onClick={handlePrint}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                >
                                    <Printer className="w-4 h-4" />
                                    Print
                                </button>
                                <button
                                    onClick={handleDownloadPNG}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                                >
                                    <Download className="w-4 h-4" />
                                    PNG
                                </button>
                                <button
                                    onClick={handleDownloadSVG}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                                >
                                    <Download className="w-4 h-4" />
                                    SVG
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={deleteConfirm.open}
                title="Hapus Kelas?"
                message={`Kelas "${deleteConfirm.name}" akan dihapus permanen beserta data siswa di dalamnya.`}
                confirmLabel="Hapus"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirm({ open: false, id: null, name: '' })}
            />
        </div>
    );
};

export default ManajemenKelas;
