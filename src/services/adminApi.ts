import { api } from './api';

// ========== USER MANAGEMENT ==========

export interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  role: 'admin' | 'teacher';
  isActive: boolean;
  createdAt: string;
  teacher?: {
    employeeId: string;
    phone?: string;
  };
}

export interface CreateUserRequest {
  name: string;
  username: string;
  nip?: string;
  email?: string;
  role: 'admin' | 'teacher';
  password?: string;
}

export interface CreateUserResponse {
  message: string;
  user: {
    id: number;
    name: string;
    email?: string;
    role: string;
    username: string;
    password: string;
    nip?: string;
  };
}

export const adminApi = {
  // Get all users
  getUsers: async (role?: string): Promise<{ users: User[] }> => {
    const params = role ? { role } : {};
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  // Validate user uniqueness
  validateUser: async (data: { nip?: string; email?: string; username?: string; excludeUserId?: number }): Promise<{ valid: boolean; errors: any }> => {
    const response = await api.post('/admin/users/validate', data);
    return response.data;
  },

  // Create user
  createUser: async (data: CreateUserRequest): Promise<CreateUserResponse> => {
    const response = await api.post('/admin/users', data);
    return response.data;
  },

  // Update user
  updateUser: async (id: number, data: Partial<CreateUserRequest>): Promise<{ message: string }> => {
    const response = await api.put(`/admin/users/${id}`, data);
    return response.data;
  },

  // Delete user
  deleteUser: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },

  // ========== MATA PELAJARAN MANAGEMENT ==========

  // Get all mapel
  getMapel: async (): Promise<{ mapel: Mapel[] }> => {
    const response = await api.get('/admin/mapel');
    return response.data;
  },

  // Validate mapel uniqueness
  validateMapel: async (data: { name?: string; code?: string; excludeMapelId?: number }): Promise<{ valid: boolean; errors: any }> => {
    const response = await api.post('/admin/mapel/validate', data);
    return response.data;
  },

  // Create mapel
  createMapel: async (data: CreateMapelRequest): Promise<{ message: string; mapel: Mapel }> => {
    const response = await api.post('/admin/mapel', data);
    return response.data;
  },

  // Update mapel
  updateMapel: async (id: number, data: Partial<CreateMapelRequest>): Promise<{ message: string }> => {
    const response = await api.put(`/admin/mapel/${id}`, data);
    return response.data;
  },

  // Delete mapel
  deleteMapel: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/admin/mapel/${id}`);
    return response.data;
  },

  // ========== DROPDOWN DATA ==========

  // Get all gurus
  getGurus: async (): Promise<{ gurus: Guru[] }> => {
    const response = await api.get('/admin/gurus');
    return response.data;
  },

  // Get all classes
  getClasses: async (): Promise<{ classes: Class[] }> => {
    const response = await api.get('/admin/classes');
    return response.data;
  },

  // ========== DASHBOARD STATS ==========

  // Get dashboard statistics
  getDashboardStats: async (): Promise<{
    stats: {
      todayAttendance: number;
      activeClasses: number;
      presentTeachers: number;
      pendingAttendance: number;
    };
    classAttendance: Array<{
      className: string;
      present: number;
      total: number;
    }>;
  }> => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  // Get recent activity
  getRecentActivity: async (): Promise<{
    activities: Array<{
      id: number;
      date: string;
      type: string;
      studentName?: string;
      className?: string;
      subjectName?: string;
      teacherName?: string;
      status?: string;
      markedBy?: string;
    }>;
  }> => {
    const response = await api.get('/admin/recent');
    return response.data;
  },

  // ========== ANALYTICS ==========

  // Get analytics data
  getAnalytics: async (start: string, end: string): Promise<any> => {
    const response = await api.get('/admin/analytics', { params: { start, end } });
    return response.data;
  },
};

export interface Mapel {
  id: number;
  code: string;
  name: string;
  description?: string;
  classes: string[];
  teachers: string[];
  scheduleCount: number;
}

export interface CreateMapelRequest {
  name: string;
  code?: string;
  classes?: string[];
  teacherId?: number;
}

export interface Guru {
  id: number;
  userId: number;
  name: string;
  nip: string;
}

export interface Class {
  id: number;
  name: string;
  level: number;
}