import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Loader2, Eye, EyeOff, User, Lock, Mail } from 'lucide-react';

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
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-[960px] min-h-[540px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">

                {/* ─── Left Panel: Dark Branding ─── */}
                <div className="relative lg:w-[55%] bg-gray-950 flex flex-col justify-between p-8 lg:p-10 overflow-hidden min-h-[200px] lg:min-h-0">
                    {/* Abstract animated background */}
                    <div className="absolute inset-0 overflow-hidden">
                        {/* Gradient blobs */}
                        <div className="absolute -top-20 -left-20 w-80 h-80 bg-gradient-to-br from-gray-700/40 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                        <div className="absolute bottom-10 -right-10 w-72 h-72 bg-gradient-to-tl from-gray-600/30 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
                        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-gradient-to-r from-white/5 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDuration: '5s' }} />

                        {/* Abstract chrome-like curves using SVG */}
                        <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="chrome1" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
                                    <stop offset="40%" stopColor="#ccc" stopOpacity="0.3" />
                                    <stop offset="60%" stopColor="#fff" stopOpacity="0.05" />
                                    <stop offset="100%" stopColor="#999" stopOpacity="0.2" />
                                </linearGradient>
                                <linearGradient id="chrome2" x1="100%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#ddd" stopOpacity="0.15" />
                                    <stop offset="50%" stopColor="#fff" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#888" stopOpacity="0.1" />
                                </linearGradient>
                            </defs>
                            {/* Flowing chrome curves */}
                            <path d="M-50,150 C100,80 150,300 300,200 S450,350 550,250" stroke="url(#chrome1)" strokeWidth="28" strokeLinecap="round" fill="none">
                                <animate attributeName="d" dur="8s" repeatCount="indefinite" values="
                                    M-50,150 C100,80 150,300 300,200 S450,350 550,250;
                                    M-50,200 C80,120 200,280 320,180 S480,320 550,220;
                                    M-50,150 C100,80 150,300 300,200 S450,350 550,250
                                " />
                            </path>
                            <path d="M-30,300 C120,220 180,400 340,320 S480,420 560,350" stroke="url(#chrome2)" strokeWidth="22" strokeLinecap="round" fill="none">
                                <animate attributeName="d" dur="10s" repeatCount="indefinite" values="
                                    M-30,300 C120,220 180,400 340,320 S480,420 560,350;
                                    M-30,340 C100,260 220,380 360,300 S500,400 560,320;
                                    M-30,300 C120,220 180,400 340,320 S480,420 560,350
                                " />
                            </path>
                            <path d="M50,420 C150,340 250,480 400,380 S520,450 600,400" stroke="url(#chrome1)" strokeWidth="16" strokeLinecap="round" fill="none" opacity="0.6">
                                <animate attributeName="d" dur="7s" repeatCount="indefinite" values="
                                    M50,420 C150,340 250,480 400,380 S520,450 600,400;
                                    M50,450 C130,370 270,460 420,360 S540,430 600,380;
                                    M50,420 C150,340 250,480 400,380 S520,450 600,400
                                " />
                            </path>
                            {/* Metallic accent circles */}
                            <circle cx="100" cy="100" r="45" stroke="url(#chrome2)" strokeWidth="3" fill="none" opacity="0.3">
                                <animate attributeName="r" dur="6s" repeatCount="indefinite" values="45;55;45" />
                            </circle>
                            <circle cx="380" cy="140" r="30" stroke="url(#chrome1)" strokeWidth="2" fill="none" opacity="0.2">
                                <animate attributeName="r" dur="5s" repeatCount="indefinite" values="30;38;30" />
                            </circle>
                        </svg>
                    </div>

                    {/* Branding top */}
                    <div className="relative z-10">
                        <h1 className="text-white text-2xl lg:text-3xl font-bold italic tracking-tight">
                            PresensiApp.
                        </h1>
                    </div>

                    {/* Welcome text bottom */}
                    <div className="relative z-10 mt-auto pt-8">
                        <h2 className="text-white text-3xl lg:text-5xl font-extrabold leading-tight">
                            Welcome<br />Back!
                        </h2>
                        <p className="text-gray-400 text-sm mt-3 max-w-xs">
                            Sistem Presensi Digital — Login untuk melanjutkan
                        </p>
                    </div>
                </div>

                {/* ─── Right Panel: Login Form ─── */}
                <div className="lg:w-[45%] flex flex-col justify-center px-8 lg:px-12 py-10 lg:py-0">
                    {/* Title */}
                    <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-8">
                        Log in
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username / Email Input */}
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                {identifier.includes('@') ? <Mail className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            <input
                                id="identifier"
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="Username atau Email"
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-100 rounded-xl border-0 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all outline-none text-sm"
                                required
                                autoComplete="username"
                            />
                        </div>

                        {/* Password Input */}
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                <Lock className="w-4 h-4" />
                            </div>
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                className="w-full pl-11 pr-12 py-3.5 bg-gray-100 rounded-xl border-0 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all outline-none text-sm"
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        {/* Login Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gray-900 text-white py-3.5 rounded-full font-semibold hover:bg-gray-800 active:scale-[0.98] disabled:bg-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-gray-900/20"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Log in'
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Hint */}
                    <p className="text-gray-400 text-xs text-center mt-5">
                        Gunakan <span className="font-medium text-gray-500">username</span> atau <span className="font-medium text-gray-500">email</span> untuk masuk
                    </p>

                    {/* Footer */}
                    <p className="text-gray-400 text-xs text-center mt-4">
                        © 2026 PresensiApp. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
