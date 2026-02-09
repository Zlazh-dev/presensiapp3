import React, { useState, useEffect } from 'react';
import { Users, BookOpen, Plus, Trash2, Edit2, Search } from 'lucide-react';
import { adminApi, type User as UserType, type Mapel, type CreateUserRequest, type CreateUserResponse, type CreateMapelRequest, type Guru, type Class as ClassType } from '../services/adminApi';
import { Modal } from '../components/ui/Modal';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'mapel'>('users');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMapelModal, setShowMapelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'user' | 'mapel'; id: number; name: string } | null>(null);
  
  // User management state
  const [users, setUsers] = useState<UserType[]>([]);
  const [userForm, setUserForm] = useState<CreateUserRequest>({
    name: '',
    role: 'teacher',
    email: '',
    nip: '',
  });
  const [userValidation, setUserValidation] = useState<any>({});
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Mapel management state
  const [mapel, setMapel] = useState<Mapel[]>([]);
  const [mapelForm, setMapelForm] = useState<CreateMapelRequest>({
    name: '',
    code: '',
    classes: [],
    teacherId: undefined,
  });
  const [mapelValidation, setMapelValidation] = useState<any>({});
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [classes, setClasses] = useState<ClassType[]>([]);
  
  // Search filters
  const [userSearch, setUserSearch] = useState('');
  const [mapelSearch, setMapelSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  
  // Loading states
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMapel, setLoadingMapel] = useState(false);
  const [loadingGurus, setLoadingGurus] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Success message
  const [successMessage, setSuccessMessage] = useState('');
  
  // Load data
  useEffect(() => {
    loadUsers();
    loadMapel();
    loadGurus();
    loadClasses();
  }, []);
  
  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await adminApi.getUsers(userRoleFilter || undefined);
      setUsers(response.users);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };
  
  const loadMapel = async () => {
    try {
      setLoadingMapel(true);
      const response = await adminApi.getMapel();
      setMapel(response.mapel);
    } catch (error) {
      console.error('Error loading mapel:', error);
    } finally {
      setLoadingMapel(false);
    }
  };
  
  const loadGurus = async () => {
    try {
      setLoadingGurus(true);
      const response = await adminApi.getGurus();
      setGurus(response.gurus);
    } catch (error) {
      console.error('Error loading gurus:', error);
    } finally {
      setLoadingGurus(false);
    }
  };
  
  const loadClasses = async () => {
    try {
      setLoadingClasses(true);
      const response = await adminApi.getClasses();
      setClasses(response.classes);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoadingClasses(false);
    }
  };
  
  // Validate user inputs in real-time
  const validateUserInput = async (field: 'nip' | 'email', value: string) => {
    try {
      const response = await adminApi.validateUser({ [field]: value });
      setUserValidation((prev: any) => ({
        ...prev,
        [field]: response.valid ? '' : response.errors[field],
      }));
    } catch (error) {
      console.error('Validation error:', error);
    }
  };
  
  // Validate mapel inputs in real-time
  const validateMapelInput = async (field: 'name' | 'code', value: string) => {
    try {
      const response = await adminApi.validateMapel({ [field]: value });
      setMapelValidation((prev: any) => ({
        ...prev,
        [field]: response.valid ? '' : response.errors[field],
      }));
    } catch (error) {
      console.error('Validation error:', error);
    }
  };
  
  // Handle user form submission
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final validation
    if (userForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
      setUserValidation((prev: any) => ({ ...prev, email: 'Invalid email format' }));
      return;
    }
    
    try {
      setSubmitting(true);
      const response = await adminApi.createUser(userForm);
      setGeneratedPassword(response.user.password);
      setShowPassword(true);
      setSuccessMessage(`User "${response.user.name}" created successfully! Password: ${response.user.password}`);
      setUserForm({ name: '', role: 'teacher', email: '', nip: '' });
      setUserValidation({});
      setShowUserModal(false);
      loadUsers();
      
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: any) {
      console.error('Error creating user:', error);
      setUserValidation({ submit: error.response?.data?.error || 'Failed to create user' });
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handle mapel form submission
  const handleMapelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      await adminApi.createMapel(mapelForm);
      setSuccessMessage(`Mata pelajaran "${mapelForm.name}" created successfully!`);
      setMapelForm({ name: '', code: '', classes: [], teacherId: undefined });
      setMapelValidation({});
      setShowMapelModal(false);
      loadMapel();
      
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: any) {
      console.error('Error creating mapel:', error);
      setMapelValidation({ submit: error.response?.data?.error || 'Failed to create mata pelajaran' });
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    try {
      setSubmitting(true);
      if (deleteTarget.type === 'user') {
        await adminApi.deleteUser(deleteTarget.id);
        setSuccessMessage(`User "${deleteTarget.name}" deleted successfully!`);
        loadUsers();
      } else {
        await adminApi.deleteMapel(deleteTarget.id);
        setSuccessMessage(`Mata pelajaran "${deleteTarget.name}" deleted successfully!`);
        loadMapel();
      }
      setShowDeleteModal(false);
      setDeleteTarget(null);
      
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert(error.response?.data?.error || 'Failed to delete');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                         user.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
                         user.teacher?.employeeId?.toLowerCase().includes(userSearch.toLowerCase());
    return matchesSearch;
  });
  
  // Filter mapel
  const filteredMapel = mapel.filter(m => {
    return m.name.toLowerCase().includes(mapelSearch.toLowerCase()) ||
           m.code.toLowerCase().includes(mapelSearch.toLowerCase());
  });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage users and mata pelajaran</p>
      </div>
      
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      
      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
              activeTab === 'users'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-5 h-5" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('mapel')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
              activeTab === 'mapel'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            Mata Pelajaran
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {activeTab === 'users' ? (
            <UserManagement
              users={filteredUsers}
              loading={loadingUsers}
              search={userSearch}
              onSearchChange={setUserSearch}
              onAddClick={() => setShowUserModal(true)}
              onDeleteClick={(id, name) => setDeleteTarget({ type: 'user', id, name })}
            />
          ) : (
            <MataPelajaranManagement
              mapel={filteredMapel}
              loading={loadingMapel}
              search={mapelSearch}
              onSearchChange={setMapelSearch}
              onAddClick={() => setShowMapelModal(true)}
              onDeleteClick={(id, name) => setDeleteTarget({ type: 'mapel', id, name })}
            />
          )}
        </div>
      </div>
      
      {/* Add User Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setUserForm({ name: '', role: 'teacher', email: '', nip: '' });
          setUserValidation({});
        }}
        title="Add New User"
      >
        <form onSubmit={handleUserSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'teacher' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="teacher">Guru</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          
          {userForm.role === 'teacher' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NIP</label>
              <input
                type="text"
                value={userForm.nip}
                onChange={(e) => {
                  setUserForm({ ...userForm, nip: e.target.value });
                  if (e.target.value) validateUserInput('nip', e.target.value);
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  userValidation.nip ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {userValidation.nip && (
                <p className="text-red-600 text-sm mt-1">{userValidation.nip}</p>
              )}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => {
                setUserForm({ ...userForm, email: e.target.value });
                if (e.target.value) validateUserInput('email', e.target.value);
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                userValidation.email ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {userValidation.email && (
              <p className="text-red-600 text-sm mt-1">{userValidation.email}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password (leave empty to auto-generate)</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={userForm.password || ''}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {userValidation.submit && (
            <p className="text-red-600 text-sm">{userValidation.submit}</p>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowUserModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || Object.values(userValidation).some(v => v)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Add User'}
            </button>
          </div>
        </form>
      </Modal>
      
      {/* Add Mapel Modal */}
      <Modal
        isOpen={showMapelModal}
        onClose={() => {
          setShowMapelModal(false);
          setMapelForm({ name: '', code: '', classes: [], teacherId: undefined });
          setMapelValidation({});
        }}
        title="Add Mata Pelajaran"
      >
        <form onSubmit={handleMapelSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={mapelForm.name}
              onChange={(e) => {
                setMapelForm({ ...mapelForm, name: e.target.value });
                if (e.target.value) validateMapelInput('name', e.target.value);
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                mapelValidation.name ? 'border-red-300' : 'border-gray-300'
              }`}
              required
            />
            {mapelValidation.name && (
              <p className="text-red-600 text-sm mt-1">{mapelValidation.name}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code (3-5 characters)</label>
            <input
              type="text"
              value={mapelForm.code}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setMapelForm({ ...mapelForm, code: value });
                if (value) validateMapelInput('code', value);
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                mapelValidation.code ? 'border-red-300' : 'border-gray-300'
              }`}
              maxLength={5}
            />
            {mapelValidation.code && (
              <p className="text-red-600 text-sm mt-1">{mapelValidation.code}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Classes</label>
            <div className="grid grid-cols-3 gap-2">
              {['7A', '7B', '8A', '8B', '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'].map(className => (
                <label key={className} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={mapelForm.classes?.includes(className)}
                    onChange={(e) => {
                      const classes = mapelForm.classes || [];
                      if (e.target.checked) {
                        setMapelForm({ ...mapelForm, classes: [...classes, className] });
                      } else {
                        setMapelForm({ ...mapelForm, classes: classes.filter(c => c !== className) });
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  {className}
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Guru Pengajar</label>
            <select
              value={mapelForm.teacherId || ''}
              onChange={(e) => setMapelForm({ ...mapelForm, teacherId: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Guru</option>
              {gurus.map(guru => (
                <option key={guru.id} value={guru.id}>
                  {guru.name} ({guru.nip})
                </option>
              ))}
            </select>
          </div>
          
          {mapelValidation.submit && (
            <p className="text-red-600 text-sm">{mapelValidation.submit}</p>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowMapelModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || Object.values(mapelValidation).some(v => v)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Add Mata Pelajaran'}
            </button>
          </div>
        </form>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }}
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteTarget(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Sub-components for better organization
const UserManagement: React.FC<{
  users: UserType[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onAddClick: () => void;
  onDeleteClick: (id: number, name: string) => void;
}> = ({ users, loading, search, onSearchChange, onAddClick, onDeleteClick }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <button
        onClick={onAddClick}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Plus className="w-4 h-4" />
        Add User
      </button>
    </div>
    
    {loading ? (
      <div className="text-center py-8 text-gray-500">Loading users...</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">NIP</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">{user.name}</td>
                <td className="py-3 px-4">{user.teacher?.employeeId || '-'}</td>
                <td className="py-3 px-4">{user.email || '-'}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => onDeleteClick(user.id, user.name)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const MataPelajaranManagement: React.FC<{
  mapel: Mapel[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onAddClick: () => void;
  onDeleteClick: (id: number, name: string) => void;
}> = ({ mapel, loading, search, onSearchChange, onAddClick, onDeleteClick }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search mata pelajaran..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <button
        onClick={onAddClick}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Plus className="w-4 h-4" />
        Add Mata Pelajaran
      </button>
    </div>
    
    {loading ? (
      <div className="text-center py-8 text-gray-500">Loading mata pelajaran...</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Classes</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Guru</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mapel.map(m => (
              <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{m.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{m.code}</span>
                </td>
                <td className="py-3 px-4">{m.classes.join(', ') || '-'}</td>
                <td className="py-3 px-4">{m.teachers.join(', ') || '-'}</td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => onDeleteClick(m.id, m.name)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {mapel.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  No mata pelajaran found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default AdminDashboard;