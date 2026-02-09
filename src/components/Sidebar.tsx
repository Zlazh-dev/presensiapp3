import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Calendar,
    UserCheck,
    ClipboardList,
    Settings,
    ScanLine,
    User,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    GraduationCap,
    Users,
    BookOpen,
} from 'lucide-react';

interface SidebarItem {
    label: string;
    path: string;
    icon: React.ElementType;
}

const Sidebar: React.FC = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path: string) => location.pathname === path;

    // Role-based menu items
    const adminItems: SidebarItem[] = [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Manajemen User', path: '/admin/users', icon: Users },
        { label: 'Mata Pelajaran', path: '/admin/mapel', icon: BookOpen },
        { label: 'Manajemen Kelas', path: '/manajemen-kelas', icon: GraduationCap },
        { label: 'Jadwal', path: '/jadwal', icon: Calendar },
        { label: 'Guru Pengganti', path: '/guru-pengganti', icon: UserCheck },
        { label: 'Rekap', path: '/rekap', icon: ClipboardList },
        { label: 'Pengaturan', path: '/settings', icon: Settings },
    ];

    const teacherItems: SidebarItem[] = [
        { label: 'Dashboard', path: '/dashboard-guru', icon: LayoutDashboard },
        { label: 'Sesi Mengajar', path: '/sesi-mengajar', icon: BookOpen },
        { label: 'Jadwal Saya', path: '/jadwal', icon: Calendar },
        { label: 'Rekap Kehadiran', path: '/rekap', icon: ClipboardList },
        { label: 'Pengaturan', path: '/settings', icon: Settings },
    ];

    const isTeacher = user?.role === 'teacher' || user?.role === 'guru';
    const menuItems = user?.role === 'admin' ? adminItems : (isTeacher ? teacherItems : []);

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-lg">P</span>
                </div>
                {!collapsed && (
                    <span className="font-semibold text-gray-900 text-lg">Presensi</span>
                )}
            </div>

            {/* Menu Items */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(item.path)
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        title={collapsed ? item.label : undefined}
                    >
                        <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive(item.path) ? 'text-blue-600' : ''}`} />
                        {!collapsed && <span>{item.label}</span>}
                    </Link>
                ))}
            </nav>

            {/* User Section */}
            <div className="border-t border-gray-200 p-3">
                {!collapsed && (
                    <div className="px-3 py-2 mb-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors ${collapsed ? 'justify-center' : ''
                        }`}
                    title="Logout"
                >
                    <LogOut className="w-5 h-5" />
                    {!collapsed && <span>Logout</span>}
                </button>
            </div>

            {/* Collapse Toggle - Desktop */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="hidden lg:flex items-center justify-center w-full py-3 border-t border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
                {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
        </div>
    );

    return (
        <>
            {/* Mobile Header Bar */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">P</span>
                    </div>
                    <span className="font-semibold text-gray-900">Presensi</span>
                </div>
                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Mobile Backdrop */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside
                className={`lg:hidden fixed top-14 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <SidebarContent />
            </aside>

            {/* Desktop Sidebar */}
            <aside
                className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 bg-white border-r border-gray-200 z-30 transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'
                    }`}
            >
                <SidebarContent />
            </aside>

            {/* Spacer for main content */}
            <div className={`hidden lg:block flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`} />
            <div className="lg:hidden h-14" /> {/* Mobile header spacer */}
        </>
    );
};

export default Sidebar;
