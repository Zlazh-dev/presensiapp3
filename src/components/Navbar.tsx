import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LogOut, ScanLine, Settings, LayoutDashboard, User } from 'lucide-react';

const Navbar: React.FC = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path: string) => location.pathname === path;

    // Role-based menu items
    const menuItems = user?.role === 'admin'
        ? [
            { label: 'Dashboard', path: '/admin-dashboard', icon: LayoutDashboard },
            { label: 'Settings', path: '/settings', icon: Settings },
        ]
        : [
            { label: 'Scan', path: '/scan', icon: ScanLine },
            { label: 'Profile', path: '/profile', icon: User },
        ];

    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to={user?.role === 'admin' ? '/admin-dashboard' : '/scan'} className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">P</span>
                        </div>
                        <span className="font-semibold text-gray-900 hidden sm:block">Presensi App</span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden sm:flex items-center gap-1">
                        {menuItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(item.path)
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </Link>
                        ))}
                    </div>

                    {/* User Info + Logout */}
                    <div className="hidden sm:flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="sm:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {mobileOpen && (
                    <div className="sm:hidden pb-4 border-t border-gray-100 mt-1 pt-3 space-y-1">
                        {menuItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setMobileOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive(item.path)
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        ))}
                        <div className="border-t border-gray-100 mt-2 pt-2">
                            <div className="px-4 py-2">
                                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <LogOut className="w-5 h-5" />
                                Logout
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
