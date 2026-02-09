import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../services/adminApi';
import {
  Users,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  ArrowRight,
  Loader2,
  Activity,
  BarChart3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DashboardOverview: React.FC = () => {
  const navigate = useNavigate();

  // Fetch dashboard stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => adminApi.getDashboardStats(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch recent activity
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => adminApi.getRecentActivity(),
    refetchInterval: 30000,
  });

  const stats = statsData?.stats;
  const classAttendance = statsData?.classAttendance || [];
  const activities = activityData?.activities || [];

  const quickLinks = [
    { label: 'Manajemen User', path: '/admin/users', icon: Users, color: 'bg-blue-500' },
    { label: 'Mata Pelajaran', path: '/admin/mapel', icon: BookOpen, color: 'bg-indigo-500' },
    { label: 'Jadwal', path: '/jadwal', icon: Calendar, color: 'bg-purple-500' },
    { label: 'Rekap Detail', path: '/rekap', icon: Activity, color: 'bg-green-500' },
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      present: 'bg-green-100 text-green-800',
      late: 'bg-yellow-100 text-yellow-800',
      absent: 'bg-red-100 text-red-800',
      sick: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1) || '-'}
      </span>
    );
  };

  const getPercentage = (present: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((present / total) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-500 mt-1">Ringkasan aktivitas dan statistik hari ini</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Hari Ini Kehadiran Siswa"
          value={stats?.todayAttendance || 0}
          icon={CheckCircle}
          color="blue"
          loading={statsLoading}
        />
        <StatsCard
          title="Total Kelas Aktif"
          value={stats?.activeClasses || 0}
          icon={BookOpen}
          color="green"
          loading={statsLoading}
        />
        <StatsCard
          title="Guru Hadir"
          value={stats?.presentTeachers || 0}
          icon={Users}
          color="purple"
          loading={statsLoading}
        />
        <StatsCard
          title="Pending Absensi"
          value={stats?.pendingAttendance || 0}
          icon={Clock}
          color="orange"
          loading={statsLoading}
          warning={stats && stats.pendingAttendance > 0}
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Attendance Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Kehadiran per Kelas</h2>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : classAttendance.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Tidak ada data kehadiran hari ini</p>
            </div>
          ) : (
            <div className="space-y-4">
              {classAttendance.map((item) => {
                const percentage = getPercentage(item.present, item.total);
                return (
                  <div key={item.className}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item.className}</span>
                      <span className="text-sm text-gray-500">
                        {item.present}/{item.total} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percentage >= 90 ? 'bg-green-500' :
                          percentage >= 70 ? 'bg-blue-500' :
                          percentage >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Aktivitas Terbaru</h2>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          
          {activityLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Belum ada aktivitas hari ini</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activities.slice(0, 10).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Activity className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {activity.studentName}
                      </span>
                      {getStatusBadge(activity.status || '')}
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <p>
                        <span className="font-medium">{activity.className}</span> · {activity.subjectName}
                      </p>
                      <p>{activity.teacherName} · {formatDate(activity.date)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Akses Cepat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <div className={`w-10 h-10 ${link.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <link.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                  {link.label}
                </p>
                <ArrowRight className="w-4 h-4 text-gray-400 -rotate-45 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange';
  loading?: boolean;
  warning?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, color, loading, warning }) => {
  const colorStyles: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${warning ? 'border-orange-300' : 'border-gray-200'} p-6`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          ) : (
            <p className={`text-3xl font-bold ${warning ? 'text-orange-600' : 'text-gray-900'}`}>
              {value}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 ${colorStyles[color]} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;