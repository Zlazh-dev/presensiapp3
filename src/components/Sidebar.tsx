import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Calendar,
    UserCheck,
    ClipboardList,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    GraduationCap,
    Users,
    BookOpen,
    BarChart3,
    FileText,
    QrCode,
} from 'lucide-react';

interface SidebarItem {
    label: string;
    path: string;
    icon: React.ElementType;
}

interface SidebarContentProps {
    collapsed: boolean;
    menuItems: SidebarItem[];
    user?: { name?: string; role?: string } | null;
    isActive: (path: string) => boolean;
    handleLogout: () => void;
    setMobileOpen: (value: boolean) => void;
    toggleCollapsed: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
    collapsed,
    menuItems,
    user,
    isActive,
    handleLogout,
    setMobileOpen,
    toggleCollapsed,
}) => (
    <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between px-5 h-16">
                <div className="flex items-center gap-3">
                    {!collapsed && (
                        <span className="font-bold text-white text-lg italic tracking-tight">
                            PresensiApp.
                        </span>
                    )}
                    {collapsed && (
                        <span className="text-white font-bold text-lg">P.</span>
                    )}
                </div>
                {/* Close button — mobile only */}
                <button
                    onClick={() => setMobileOpen(false)}
                    className="lg:hidden p-2 -mr-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive(item.path)
                            ? 'bg-white text-gray-900 shadow-lg shadow-black/20'
                            : 'text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                        title={collapsed ? item.label : undefined}
                    >
                        <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive(item.path) ? 'text-gray-900' : ''}`} />
                        {!collapsed && <span>{item.label}</span>}
                    </Link>
                ))}
            </nav>

            {/* User Section */}
            <div className="border-t border-white/10 p-3">
                {!collapsed && (
                    <div className="px-3 py-2 mb-2">
                        <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors ${collapsed ? 'justify-center' : ''
                        }`}
                    title="Logout"
                >
                    <LogOut className="w-5 h-5" />
                    {!collapsed && <span>Logout</span>}
                </button>
            </div>

            {/* Collapse Toggle - Desktop */}
            <button
                onClick={toggleCollapsed}
                className="hidden lg:flex items-center justify-center w-full py-3 border-t border-white/10 text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            >
                {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
        </div>
    );

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
        { label: 'Analitik', path: '/analitik', icon: BarChart3 },
        { label: 'Manajemen User', path: '/admin/users', icon: Users },
        { label: 'Mata Pelajaran', path: '/admin/mapel', icon: BookOpen },
        { label: 'Manajemen Kelas', path: '/manajemen-kelas', icon: GraduationCap },
        { label: 'Jadwal', path: '/jadwal', icon: Calendar },
        { label: 'Guru Pengganti', path: '/guru-pengganti', icon: UserCheck },
        { label: 'Rekap', path: '/rekap', icon: ClipboardList },
        { label: 'Izin Guru', path: '/izin-guru', icon: FileText },
        { label: 'QR Registrasi', path: '/admin/qr', icon: QrCode },
        { label: 'Pengaturan', path: '/settings', icon: Settings },
    ];

    const teacherItems: SidebarItem[] = [
        { label: 'Dashboard', path: '/dashboard-guru', icon: LayoutDashboard },
        { label: 'Sesi Mengajar', path: '/sesi-mengajar', icon: BookOpen },
        { label: 'Jadwal Saya', path: '/guru/jadwal', icon: Calendar },
        { label: 'Rekap Kehadiran', path: '/guru/rekap', icon: ClipboardList },
        { label: 'Izin / Sakit', path: '/guru/izin-sakit', icon: FileText },
    ];

    const isTeacher = user?.role === 'teacher' || user?.role === 'guru';
    const menuItems = user?.role === 'admin' ? adminItems : (isTeacher ? teacherItems : []);

    return (
        <>
            {/* Mobile Header Bar */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-gray-950 flex items-center justify-between px-4 z-40">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-white italic tracking-tight">PresensiApp.</span>
                </div>
                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Mobile Backdrop */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Mobile Sidebar — full width, full height */}
            <aside
                className={`lg:hidden fixed inset-0 w-full bg-gray-950 z-[60] transform transition-transform duration-300 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <SidebarContent
                    collapsed={collapsed}
                    menuItems={menuItems}
                    user={user}
                    isActive={isActive}
                    handleLogout={handleLogout}
                    setMobileOpen={setMobileOpen}
                    toggleCollapsed={() => setCollapsed(!collapsed)}
                />
            </aside>

            {/* Desktop Sidebar */}
            <aside
                className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 bg-gray-950 z-30 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'
                    }`}
            >
                <SidebarContent
                    collapsed={collapsed}
                    menuItems={menuItems}
                    user={user}
                    isActive={isActive}
                    handleLogout={handleLogout}
                    setMobileOpen={setMobileOpen}
                    toggleCollapsed={() => setCollapsed(!collapsed)}
                />
            </aside>

            {/* Spacer for main content — desktop only */}
            <div className={`hidden lg:block flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`} />
        </>
    );
};

export default Sidebar;
