import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, QrCode, Calendar, FileBarChart, Settings, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
    const { user, logout } = useAuth();

    // DEBUG: Check user role
    console.log('Sidebar user:', user);
    console.log('Sidebar role:', user?.role);

    const adminItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Users, label: 'Users', path: '/admin/users' },
        { icon: FileBarChart, label: 'Mapel & Jurusan', path: '/admin/mapel' },
        { icon: Users, label: 'Manajemen Kelas', path: '/manajemen-kelas' },
        { icon: Calendar, label: 'Jadwal', path: '/jadwal' },
        { icon: Users, label: 'Guru Pengganti', path: '/guru-pengganti' },
        { icon: FileBarChart, label: 'Rekap', path: '/rekap' },
        { icon: FileBarChart, label: 'Laporan', path: '/laporan' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    const teacherItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard-guru' },
        { icon: QrCode, label: 'Sesi Mengajar', path: '/sesi-mengajar' },
        { icon: Calendar, label: 'Jadwal Saya', path: '/jadwal' },
        { icon: FileBarChart, label: 'Rekap Kehadiran', path: '/rekap' },
        { icon: Settings, label: 'Pengaturan', path: '/settings' },
    ];

    const isTeacher = user?.role === 'teacher' || user?.role === 'guru';
    const navItems = isTeacher ? teacherItems : adminItems;

    return (
        <div className="h-screen w-64 bg-card border-r flex flex-col fixed left-0 top-0 z-30">
            <div className="p-6 flex items-center gap-2 border-b">
                <QrCode className="w-8 h-8 text-primary" />
                <span className="font-bold text-xl">PresensiApp</span>
            </div>

            <div className="px-6 py-4 border-b bg-muted/20">
                <p className="text-sm font-semibold truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role || 'Guest'}</p>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-4 py-3 w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-sm font-medium"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
