import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Loader2, Eye, EyeOff, User, Lock, Mail, ArrowRight } from 'lucide-react';

const Login: React.FC = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { identifier, password });
            const { token, user } = response.data;
            login(token, user);

            if (user.role === 'admin') {
                navigate('/dashboard');
            } else {
                navigate('/dashboard-guru');
            }
        } catch (err: any) {
            const message = err.response?.data?.error || err.message || 'Login failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-[1100px] min-h-[600px] bg-white rounded-[2rem] shadow-xl overflow-hidden flex flex-col lg:flex-row">

                {/* ─── Left Panel: Login Form ─── */}
                <div className="lg:w-1/2 flex flex-col justify-center px-8 lg:px-16 py-12 lg:py-0 bg-white">
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                                <span className="text-white font-bold text-lg">P</span>
                            </div>
                            <span className="text-xl font-bold text-gray-900 tracking-tight">PresensiApp.</span>
                        </div>

                        <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                            Selamat Datang!
                        </h2>
                        <p className="text-gray-500 text-sm lg:text-base">
                            Silakan masukkan detail akun Anda untuk memulai.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username / Email Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-700 ml-1 uppercase tracking-wider">
                                Username / Email
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-600 transition-colors">
                                    {identifier.includes('@') ? <Mail className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                </div>
                                <input
                                    id="identifier"
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="Masukkan username atau email"
                                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50 rounded-xl border border-gray-100 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 focus:bg-white transition-all outline-none text-sm font-medium"
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Password
                                </label>
                            </div>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-600 transition-colors">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Masukkan password"
                                    className="w-full pl-11 pr-12 py-3.5 bg-gray-50 rounded-xl border border-gray-100 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 focus:bg-white transition-all outline-none text-sm font-medium"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-600 transition-colors p-1"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}

                        {/* Login Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-600 active:scale-[0.98] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-xl shadow-gray-200 hover:shadow-emerald-200"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Masuk...
                                    </>
                                ) : (
                                    <>
                                        Masuk Sekarang
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                        <p className="text-gray-400 text-xs">
                            © 2026 PresensiApp. Digital Attendance System.
                        </p>
                    </div>
                </div>

                {/* ─── Right Panel: Image Display ─── */}
                <div className="hidden lg:block lg:w-1/2 relative bg-emerald-50 p-4">
                    <div className="h-full w-full rounded-[1.5rem] overflow-hidden relative group">
                        <img
                            src="/images/school_login.png"
                            alt="School Architecture"
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent"></div>

                        <div className="absolute bottom-10 left-10 right-10 text-white">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-xs font-medium mb-4">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Sistem Aktif
                            </div>
                            <h3 className="text-2xl font-bold leading-tight mb-2">
                                Efisiensi & Kedisiplinan <br />dalam Satu Aplikasi.
                            </h3>
                            <p className="text-white/80 text-sm leading-relaxed max-w-sm">
                                Kelola kehadiran, jadwal, dan laporan akademik dengan mudah dan real-time.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Login;
