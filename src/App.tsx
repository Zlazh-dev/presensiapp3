import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import SesiMengajar from './pages/SesiMengajar';
import GuruDashboard from './pages/GuruDashboard';
import Settings from './pages/Settings';
import DashboardOverview from './pages/DashboardOverview';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminMapelPage from './pages/AdminMapelPage';
import Jadwal from './pages/Jadwal';
import GuruPengganti from './pages/GuruPengganti';
import Rekap from './pages/Rekap';
import Laporan from './pages/Laporan';
import ManajemenKelas from './pages/ManajemenKelas';
import KelolaSiswa from './pages/KelolaSiswa';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import MainLayout from './components/MainLayout';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected Routes with Sidebar Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              {/* Teacher Routes */}
              <Route path="/dashboard-guru" element={<GuruDashboard />} />
              <Route path="/sesi-mengajar" element={<SesiMengajar />} />
              <Route path="/profile" element={<div className="text-center text-gray-500 py-12">Profile page — coming soon</div>} />
              <Route path="/" element={<Navigate to="/sesi-mengajar" replace />} />
            </Route>
          </Route>

          {/* Admin-only Routes with Sidebar Layout */}
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
              <Route path="/settings" element={<Settings />} />
              <Route path="/laporan" element={<Laporan />} />
            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
