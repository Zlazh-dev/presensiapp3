import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi, type User, type CreateUserRequest } from '../services/adminApi';
import { Users, Plus, Pencil, Trash2, Search, Save, X, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const AdminUsersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<CreateUserRequest>({
    name: '',
    username: '',
    nip: '',
    email: '',
    role: 'teacher',
    password: '',
  });

  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Debounce helper
  const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
  };

  const debouncedUsername = useDebounce(formData.username, 500);
  const debouncedEmail = useDebounce(formData.email || '', 500);

  // Real-time username validation
  useEffect(() => {
    const validate = async () => {
      if (!debouncedUsername) return;
      if (debouncedUsername.length < 3) return;

      setIsCheckingUsername(true);
      try {
        // We reuse the validateUser endpoint or just check basic constraints for now
        // Ideally backend has a specific check-username endpoint, but validateUser works
        const res = await adminApi.validateUser({
          username: debouncedUsername,
          excludeUserId: selectedUser?.id
        });

        setValidationErrors(prev => {
          const next = { ...prev };
          if (res.errors?.username) {
            next.username = res.errors.username;
          } else {
            delete next.username;
          }
          return next;
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsCheckingUsername(false);
      }
    };

    if (debouncedUsername) validate();
  }, [debouncedUsername, selectedUser]);

  // Real-time email validation
  useEffect(() => {
    const validate = async () => {
      if (!debouncedEmail) return;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(debouncedEmail)) return; // Don't check backend if format is invalid

      try {
        // We reuse the validateUser endpoint
        const res = await adminApi.validateUser({
          email: debouncedEmail,
          excludeUserId: selectedUser?.id
        });

        setValidationErrors(prev => {
          const next = { ...prev };
          if (res.errors?.email) {
            next.email = res.errors.email;
          } else {
            delete next.email;
          }
          return next;
        });
      } catch (error) {
        console.error(error);
      }
    };

    if (debouncedEmail) validate();
  }, [debouncedEmail, selectedUser]);

  // Fetch users
  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => adminApi.getUsers(),
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      showToast('User berhasil ditambahkan', 'success');
      // setShowAddModal(false); // Removed unused state
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      showToast(error.response?.data?.error || error.response?.data?.message || 'Gagal menambahkan user', 'error');
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateUserRequest> }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => {
      showToast('User berhasil diupdate', 'success');
      setShowEditModal(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      showToast(error.response?.data?.error || error.response?.data?.message || 'Gagal mengupdate user', 'error');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      showToast('User berhasil dihapus', 'success');
      setShowDeleteModal(false);
      setSelectedUser(null);
      refetch();
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Gagal menghapus user', 'error');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      nip: '',
      email: '',
      role: 'teacher',
      password: '',
    });
    setValidationErrors({});
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateForm = async (isEdit = false) => {
    const errors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'Nama lengkap wajib diisi';
    }

    if (!formData.username.trim()) {
      errors.username = 'Username wajib diisi';
    } else {
      if (!/^[a-z0-9_-]+$/.test(formData.username)) {
        errors.username = 'Username hanya boleh huruf kecil, angka, underscore, dan strip';
      }
      if (formData.username.length < 3 || formData.username.length > 20) {
        errors.username = 'Username harus 3-20 karakter';
      }
    }

    if (!formData.role) {
      errors.role = 'Role wajib dipilih';
    }

    if (formData.email && !validateEmail(formData.email)) {
      errors.email = 'Format email tidak valid';
    }

    // Backend validation for uniqueness
    try {
      const excludeUserId = isEdit && selectedUser ? selectedUser.id : undefined;
      const validation = await adminApi.validateUser({
        nip: formData.nip,
        email: formData.email,
        username: formData.username,
        excludeUserId,
      });

      if (!validation.valid && validation.errors) {
        if (validation.errors.nip) {
          errors.nip = validation.errors.nip;
        }
        if (validation.errors.email) {
          errors.email = validation.errors.email;
        }
        if (validation.errors.username) {
          errors.username = validation.errors.username;
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

    if (isEdit && selectedUser) {
      updateUserMutation.mutate({
        id: selectedUser.id,
        data: formData,
      });
    } else {
      createUserMutation.mutate(formData);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      nip: user.teacher?.employeeId,
      email: user.email,
      role: user.role,
      password: '',
    });
    setShowEditModal(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredUsers = usersData?.users?.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.teacher?.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manajemen User</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Kelola pengguna sistem (Admin dan Guru)</p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Add User Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Tambah User Baru</h2>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Lengkap *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  // Auto-generate username if empty or strictly follows previous name
                  const simpleName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const currentSimpleUsername = formData.username.replace(/[^a-z0-9]/g, '');

                  // Simple heuristic: if username looks like it was generated from the name (or is empty), update it
                  // But we don't want to overwrite if user manually typed something different.
                  // For simplicity in this iteration: Only update if username is empty or matches the start of new name

                  let newData = { ...formData, name };

                  if (!formData.username || currentSimpleUsername === simpleName.slice(0, currentSimpleUsername.length)) {
                    // Generate username: lowercase, remove spaces, max 20 chars
                    const generated = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_-]/g, '').substring(0, 20);
                    newData.username = generated;
                  }
                  setFormData(newData);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masukkan nama lengkap"
              />
              {validationErrors.name && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => {
                    // Force lowercase and allowed chars only
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                    setFormData({ ...formData, username: val });
                  }}
                  className={`w-full pl-7 pr-10 py-2 border rounded-lg focus:ring-2 focus:border-transparent font-mono text-sm ${validationErrors.username
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                    }`}
                  placeholder="username"
                  maxLength={20}
                />
                {isCheckingUsername && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  </div>
                )}
              </div>
              {validationErrors.username && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NIP
              </label>
              <input
                type="text"
                value={formData.nip || ''}
                onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masukkan NIP (opsional)"
              />
              {validationErrors.nip && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.nip}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="nama@email.com"
              />
              {validationErrors.email && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'teacher' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="teacher">Guru</option>
                <option value="admin">Admin</option>
              </select>
              {validationErrors.role && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.role}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
                  placeholder={formData.password ? "" : "Biarkan kosong untuk auto-generate"}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title={showPassword ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const randomPass = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '!';
                      setFormData({ ...formData, password: randomPass });
                      setShowPassword(true);
                    }}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                    title="Generate Random Password"
                  >
                    🎲
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {createUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Tambah User
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Daftar User</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Cari user..."
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Tidak ada user ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Nama / Username</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">NIP</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{user.teacher?.employeeId || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{user.email || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                        }`}>
                        {user.role === 'admin' ? 'Admin' : 'Guru'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
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
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
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
                    Nama Lengkap *
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
                    Username *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                        setFormData({ ...formData, username: val });
                      }}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="username"
                      maxLength={20}
                    />
                  </div>
                  {validationErrors.username && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.username}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NIP
                  </label>
                  <input
                    type="text"
                    value={formData.nip || ''}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {validationErrors.nip && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.nip}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {validationErrors.email && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'teacher' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="teacher">Guru</option>
                    <option value="admin">Admin</option>
                  </select>
                  {validationErrors.role && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.role}</p>
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
                  disabled={updateUserMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {updateUserMutation.isPending ? (
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
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Hapus User?
              </h3>
              <p className="text-gray-600 mb-6">
                Anda yakin ingin menghapus user <strong>{selectedUser.name}</strong>?
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
                  disabled={deleteUserMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteUserMutation.isPending ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;