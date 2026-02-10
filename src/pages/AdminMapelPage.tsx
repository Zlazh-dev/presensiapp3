import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi, type Mapel, type CreateMapelRequest } from '../services/adminApi';
import { BookOpen, Plus, Pencil, Trash2, Search, Save, X, Loader2, AlertCircle, Calendar, ArrowRight } from 'lucide-react';

const AdminMapelPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMapel, setSelectedMapel] = useState<Mapel | null>(null);

  const [formData, setFormData] = useState<Pick<CreateMapelRequest, 'name' | 'code'>>({
    name: '',
    code: '',
  });

  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch mapel
  const { data: mapelData, isLoading, refetch } = useQuery({
    queryKey: ['mapel'],
    queryFn: () => adminApi.getMapel(),
  });

  // Create mapel mutation
  const createMapelMutation = useMutation({
    mutationFn: adminApi.createMapel,
    onSuccess: () => {
      showToast('Mapel berhasil ditambahkan', 'success');
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Gagal menambahkan mapel', 'error');
    },
  });

  // Update mapel mutation
  const updateMapelMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateMapelRequest> }) =>
      adminApi.updateMapel(id, data),
    onSuccess: () => {
      showToast('Mapel berhasil diupdate', 'success');
      setShowEditModal(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Gagal mengupdate mapel', 'error');
    },
  });

  // Delete mapel mutation
  const deleteMapelMutation = useMutation({
    mutationFn: adminApi.deleteMapel,
    onSuccess: () => {
      showToast('Mapel berhasil dihapus', 'success');
      setShowDeleteModal(false);
      setSelectedMapel(null);
      refetch();
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Gagal menghapus mapel', 'error');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
    });
    setValidationErrors({});
  };

  const validateForm = async (isEdit = false) => {
    const errors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'Nama mapel wajib diisi';
    }

    if (formData.code && formData.code.length < 3) {
      errors.code = 'Kode mapel minimal 3 karakter';
    }

    if (formData.code && formData.code.length > 5) {
      errors.code = 'Kode mapel maksimal 5 karakter';
    }

    // Backend validation for uniqueness
    try {
      const excludeMapelId = isEdit && selectedMapel ? selectedMapel.id : undefined;
      const validation = await adminApi.validateMapel({
        name: formData.name,
        code: formData.code,
        excludeMapelId,
      });

      if (!validation.valid && validation.errors) {
        if (validation.errors.name) {
          errors.name = validation.errors.name;
        }
        if (validation.errors.code) {
          errors.code = validation.errors.code;
        }
      }
    } catch (error: any) {
      if (error.response?.data?.errors) {
        Object.assign(errors, error.response.data.errors);
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent, isEdit = false) => {
    e.preventDefault();

    const isValid = await validateForm(isEdit);
    if (!isValid) return;

    if (isEdit && selectedMapel) {
      updateMapelMutation.mutate({
        id: selectedMapel.id,
        data: formData,
      });
    } else {
      createMapelMutation.mutate(formData);
    }
  };

  const handleEdit = (mapel: Mapel) => {
    setSelectedMapel(mapel);
    setFormData({
      name: mapel.name,
      code: mapel.code,
    });
    setShowEditModal(true);
  };

  const handleDelete = (mapel: Mapel) => {
    setSelectedMapel(mapel);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedMapel) {
      deleteMapelMutation.mutate(selectedMapel.id);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredMapel = mapelData?.mapel?.filter(mapel =>
    mapel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mapel.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mata Pelajaran</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Kelola mata pelajaran dan penugasan guru</p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Add Mapel Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Tambah Mapel Baru</h2>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Mapel *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Contoh: Matematika"
              />
              {validationErrors.name && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kode Mapel (Opsional)
              </label>
              <input
                type="text"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Contoh: MTK (3-5 karakter)"
                maxLength={5}
              />
              {validationErrors.code && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.code}</p>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Penugasan jadwal dilakukan terpisah
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Setelah membuat mapel, Anda dapat mengatur jadwal melalui menu <strong>Jadwal</strong> untuk menugaskan guru dan kelas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createMapelMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {createMapelMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Tambah Mapel
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Mapel Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Daftar Mata Pelajaran</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Cari mapel..."
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredMapel.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Tidak ada mapel ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[550px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm">Nama</th>
                  <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm">Kode</th>
                  <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm">Jadwal</th>
                  <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMapel.map((mapel) => (
                  <tr key={mapel.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{mapel.name}</p>
                    </td>
                    <td className="py-3 px-4">
                      {mapel.code ? (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-mono">
                          {mapel.code}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {mapel.classes.slice(0, 3).map((className, idx) => (
                            <div
                              key={className}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-indigo-500' : 'bg-purple-500'
                                }`}
                              style={{ zIndex: 3 - idx }}
                            >
                              {className}
                            </div>
                          ))}
                          {mapel.classes.length > 3 && (
                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600" style={{ zIndex: 0 }}>
                              +{mapel.classes.length - 3}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {mapel.scheduleCount} Jadwal
                          </span>
                          <span className="text-xs text-gray-500">
                            {mapel.teachers.length} Guru · {mapel.classes.length} Kelas
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            // Navigate to jadwal page with mapel filter
                            window.location.href = `/jadwal?mapelId=${mapel.id}`;
                          }}
                          className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-xs sm:text-sm font-medium"
                          title="Kelola Jadwal"
                        >
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span className="hidden sm:inline">Kelola</span> Jadwal
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(mapel)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mapel)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
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
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedMapel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Edit Mapel</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={(e) => handleSubmit(e, true)} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Mapel *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {validationErrors.name && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kode Mapel (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={5}
                  />
                  {validationErrors.code && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.code}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updateMapelMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {updateMapelMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Simpan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedMapel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Hapus Mapel?
              </h3>
              <p className="text-gray-600 mb-6">
                Anda yakin ingin menghapus mapel <strong>{selectedMapel.name}</strong>?
                Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteMapelMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteMapelMutation.isPending ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMapelPage;