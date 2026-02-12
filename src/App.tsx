import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import PublicRegister from './pages/PublicRegister';
import SesiMengajar from './pages/SesiMengajar';
import GuruDashboard from './pages/GuruDashboard';
import JadwalSaya from './pages/JadwalSaya';
import Settings from './pages/Settings';
import DashboardOverview from './pages/DashboardOverview';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminMapelPage from './pages/AdminMapelPage';
import Jadwal from './pages/Jadwal';
import GuruPengganti from './pages/GuruPengganti';
import AdminQRGenerator from './pages/AdminQRGenerator';
import Rekap from './pages/Rekap';
import Analitik from './pages/Analitik';
import Laporan from './pages/Laporan';
import IzinGuru from './pages/IzinGuru';
import ManajemenKelas from './pages/ManajemenKelas';
import KelolaSiswa from './pages/KelolaSiswa';
import IzinSakitPage from './pages/guru/IzinSakitPage';
import AdminRoute from './components/AdminRoute';
import TeacherRoute from './components/TeacherRoute';
import MainLayout from './components/MainLayout';

// Redirect `/` based on user role
const RoleRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'admin') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/dashboard-guru" replace />;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<PublicRegister />} />

          {/* Teacher Routes */}
          <Route element={<TeacherRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard-guru" element={<GuruDashboard />} />
              <Route path="/sesi-mengajar" element={<SesiMengajar />} />
              <Route path="/guru/jadwal" element={<JadwalSaya />} />
              <Route path="/guru/rekap" element={<Rekap />} />
              <Route path="/guru/izin-sakit" element={<IzinSakitPage />} />
              <Route path="/profile" element={<div className="text-center text-gray-500 py-12">Profile page — coming soon</div>} />
            </Route>
          </Route>

          {/* Admin-only Routes */}
          <Route element={<AdminRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<DashboardOverview />} />
              <Route path="/admin-dashboard" element={<Navigate to="/dashboard" replace />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/mapel" element={<AdminMapelPage />} />
              <Route path="/manajemen-kelas" element={<ManajemenKelas />} />
              <Route path="/kelas/:id/siswa" element={<KelolaSiswa />} />
              <Route path="/jadwal" element={<Jadwal />} />
              <Route path="/guru-pengganti" element={<GuruPengganti />} />
              <Route path="/rekap" element={<Rekap />} />
              <Route path="/analitik" element={<Analitik />} />
              <Route path="/izin-guru" element={<IzinGuru />} />
              <Route path="/izin-guru" element={<IzinGuru />} />
              <Route path="/admin/qr" element={<AdminQRGenerator />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/laporan" element={<Laporan />} />
            </Route>
          </Route>

          {/* Role-based root redirect */}
          <Route path="/" element={<RoleRedirect />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;

