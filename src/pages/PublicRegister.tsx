import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
    CheckCircle2,
    AlertCircle,
    Loader2,
    User,
    Lock,
    Briefcase,
    Phone,
    BadgeCheck,
    ArrowRight
} from 'lucide-react';

const PublicRegister = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    // States
    const [validating, setValidating] = useState(true);
    const [tokenData, setTokenData] = useState<{ valid: boolean; role: string; description: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        nip: '',
        phone: ''
    });

    useEffect(() => {
        if (!token) {
            setValidating(false);
            setError('Token registrasi tidak ditemukan.');
            return;
        }
        validateToken(token);
    }, [token]);

    const validateToken = async (tokenStr: string) => {
        try {
            // Use standard fetch or axios, assuming public endpoint
            const res = await axios.get(`/api/auth/validate-token/${tokenStr}`);
            setTokenData(res.data);
            setValidating(false);
        } catch (err: any) {
            setValidating(false);
            setError(err.response?.data?.error || 'Token tidak valid atau kadaluarsa.');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert('Password tidak sama');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('/api/auth/register-with-token', {
                token,
                ...formData
            });
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Registrasi gagal');
        } finally {
            setSubmitting(false);
        }
    };

    if (validating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground">Memvalidasi token...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Akses Ditolak</h2>
                        <p className="text-gray-500 mt-2">{error}</p>
                    </div>
                    <Link to="/login" className="inline-block px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                        Kembali ke Login
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Registrasi Berhasil!</h2>
                        <p className="text-gray-500 mt-2">Akun Anda telah dibuat. Mengalihkan ke halaman login...</p>
                    </div>
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gray-50">
            {/* Left Panel - Visual (Desktop only) */}
            <div className="hidden lg:flex w-1/2 p-12 bg-gray-900 text-white flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1497294815431-9365093b7331?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] opacity-10 bg-cover bg-center"></div>
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold italic tracking-tight">PresensiApp.</h1>
                </div>
                <div className="relative z-10 space-y-6 max-w-lg">
                    <h2 className="text-4xl font-bold leading-tight">Selamat Datang di Sistem Presensi Digital</h2>
                    <p className="text-gray-400 text-lg">Silakan lengkapi data diri Anda untuk mengaktifkan akun Guru dan mulai menggunakan layanan presensi digital.</p>
                    <div className="flex items-center gap-4 pt-4">
                        <div className="flex -space-x-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="w-10 h-10 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs">User</div>
                            ))}
                        </div>
                        <span className="text-sm font-medium">Bergabung dengan 50+ Guru lainnya</span>
                    </div>
                </div>
                <div className="relative z-10 text-sm text-gray-500">
                    &copy; 2026 PresensiApp Inc. All rights reserved.
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-2xl font-bold text-gray-900">Aktivasi Akun Baru</h2>
                        <p className="text-muted-foreground mt-2">
                            Token valid: <span className="font-semibold text-primary">{tokenData?.description}</span>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-4">
                            <div className="relative">
                                <label className="text-sm font-medium mb-1 block">Nama Lengkap</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input
                                        name="fullName"
                                        type="text"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                        placeholder="Contoh: Budi Santoso, S.Pd"
                                        value={formData.fullName}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="relative">
                                <label className="text-sm font-medium mb-1 block">Username</label>
                                <div className="relative">
                                    <BadgeCheck className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input
                                        name="username"
                                        type="text"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                        placeholder="Username untuk login"
                                        value={formData.username}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            {tokenData?.role === 'teacher' && (
                                <>
                                    <div className="relative">
                                        <label className="text-sm font-medium mb-1 block">NIP / NUPTK</label>
                                        <div className="relative">
                                            <Briefcase className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                            <input
                                                name="nip"
                                                type="text"
                                                required
                                                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                                placeholder="Nomor Induk Pegawai"
                                                value={formData.nip}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <label className="text-sm font-medium mb-1 block">Nomor WhatsApp</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                            <input
                                                name="phone"
                                                type="tel"
                                                required
                                                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                                placeholder="0812..."
                                                value={formData.phone}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className="text-sm font-medium mb-1 block">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                        <input
                                            name="password"
                                            type="password"
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                                <div className="relative">
                                    <label className="text-sm font-medium mb-1 block">Konfirmasi</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                        <input
                                            name="confirmPassword"
                                            type="password"
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                            placeholder="••••••••"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-900/20"
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Daftar Sekarang <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PublicRegister;
