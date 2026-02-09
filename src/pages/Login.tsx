import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Loader2, Eye, EyeOff, Users, LogIn } from 'lucide-react';

interface TestUser {
    id: number;
    username: string;
    email: string | null;
    role: string;
    name: string;
}

const Login: React.FC = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [testUsers, setTestUsers] = useState<TestUser[] | null>(null);
    const [loadingTestUsers, setLoadingTestUsers] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { identifier, password });
            const { token, user } = response.data;

            // Store in AuthContext + localStorage
            login(token, user);

            // Navigate based on role
            if (user.role === 'admin') {
                navigate('/admin-dashboard');
            } else {
                navigate('/dashboard-guru');
            }
        } catch (err: any) {
            // Show exact error from backend
            const message = err.response?.data?.error || err.message || 'Login failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTestUsers = async () => {
        setLoadingTestUsers(true);
        try {
            const response = await api.get('/auth/test-users');
            setTestUsers(response.data.users);
        } catch (err: any) {
            setError('Failed to fetch test users: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoadingTestUsers(false);
        }
    };

    const fillCredentials = (username: string) => {
        setIdentifier(username);
        // Default password for seeded users
        setPassword(username === 'admin' ? 'admin123' : 'guru123');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
                        <LogIn className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Presensi App</h1>
                    <p className="text-blue-200 mt-2">Teacher Attendance System</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Identifier Input */}
                        <div>
                            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-2">
                                Identifier (username or email)
                            </label>
                            <input
                                id="identifier"
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="guru1 or guru1@example.com"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                required
                                autoComplete="username"
                            />
                        </div>

                        {/* Password Input */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none pr-12"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Test Backend Button */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <button
                            onClick={fetchTestUsers}
                            disabled={loadingTestUsers}
                            className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                            {loadingTestUsers ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Users className="w-4 h-4" />
                            )}
                            Test Backend - Show Seeded Users
                        </button>

                        {/* Test Users Table */}
                        {testUsers && testUsers.length > 0 && (
                            <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium text-gray-600">Username</th>
                                            <th className="px-3 py-2 text-left font-medium text-gray-600">Role</th>
                                            <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {testUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-2">
                                                    <div className="font-medium">{user.username}</div>
                                                    <div className="text-xs text-gray-400">{user.email || '—'}</div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <button
                                                        onClick={() => fillCredentials(user.username)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                    >
                                                        Use →
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="px-3 py-2 bg-yellow-50 text-xs text-yellow-700">
                                    💡 Passwords: <code className="bg-yellow-100 px-1 rounded">admin123</code> for admin, <code className="bg-yellow-100 px-1 rounded">guru123</code> for teachers
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-blue-200 text-sm mt-6">
                    © 2026 Presensi App. All rights reserved.
                </p>
            </div>
        </div>
    );
};

export default Login;
