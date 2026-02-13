import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import QRCode from 'react-qr-code';
import {
    QrCode,
    Plus,
    Copy,
    Printer,
    Users,
    CheckCircle,
    XCircle,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Token {
    token: string;
    description: string;
    maxUses: number | null;
    usedCount: number;
    expiresAt: string | null;
    isActive: boolean;
    role: string;
    createdAt: string;
}

const AdminQRGenerator = () => {
    const { token } = useAuth();
    const [tokens, setTokens] = useState<Token[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Form State
    const [description, setDescription] = useState('');
    const [maxUses, setMaxUses] = useState<number | ''>(1);
    const [expiresIn, setExpiresIn] = useState('24'); // hours

    // Modal State
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);

    const api = axios.create({
        baseURL: '/api',
        headers: { Authorization: `Bearer ${token}` }
    });

    useEffect(() => {
        fetchTokens();
    }, []);

    const fetchTokens = async () => {
        try {
            const res = await api.get('/auth/tokens');
            setTokens(res.data);
        } catch (err) {
            console.error('Error fetching tokens:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setGenerating(true);
        try {
            await api.post('/auth/tokens', {
                description,
                maxUses: maxUses === '' ? null : Number(maxUses),
                expiresInHours: Number(expiresIn),
                role: 'teacher'
            });
            setDescription('');
            setMaxUses(1);
            setExpiresIn('24');
            fetchTokens();
        } catch (err) {
            console.error('Error generating token:', err);
            alert('Gagal membuat token');
        } finally {
            setGenerating(false);
        }
    };

    const getRegistrationLink = (tokenStr: string) => {
        return `${window.location.origin}/register?token=${tokenStr}`;
    };

    const copyLink = (tokenStr: string) => {
        const link = getRegistrationLink(tokenStr);
        navigator.clipboard.writeText(link);
        alert('Link disalin ke clipboard!');
    };



    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <QrCode className="w-8 h-8" />
                    Manajemen QR Registrasi
                </h1>
            </div>

            {/* Generator Card */}
            <div className="bg-card border rounded-lg p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Buat Token Baru</h2>
                <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2 col-span-1 md:col-span-2">
                        <label className="text-sm font-medium">Deskripsi (Opsional)</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Contoh: Rapat Guru Senin"
                            className="w-full p-2 border rounded-md bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Batas Penggunaan</label>
                        <input
                            type="number"
                            value={maxUses}
                            onChange={(e) => setMaxUses(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0 = Unlimited"
                            min="0"
                            className="w-full p-2 border rounded-md bg-background"
                        />
                        <p className="text-xs text-muted-foreground">0 atau kosong = Tak Terbatas</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Kadaluarsa (Jam)</label>
                        <select
                            value={expiresIn}
                            onChange={(e) => setExpiresIn(e.target.value)}
                            className="w-full p-2 border rounded-md bg-background"
                        >
                            <option value="1">1 Jam</option>
                            <option value="24">24 Jam</option>
                            <option value="48">48 Jam (2 Hari)</option>
                            <option value="168">1 Minggu</option>
                            <option value="0">Selamanya</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={generating}
                        className="bg-primary text-primary-foreground p-2 rounded-md font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
                    >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Generate
                    </button>
                </form>
            </div>

            {/* Tokens List */}
            <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="p-4 text-left font-medium">Deskripsi</th>
                                <th className="p-4 text-left font-medium">Status</th>
                                <th className="p-4 text-left font-medium">Penggunaan</th>
                                <th className="p-4 text-left font-medium">Kadaluarsa</th>
                                <th className="p-4 text-left font-medium">Dibuat</th>
                                <th className="p-4 text-right font-medium">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">Loading...</td>
                                </tr>
                            ) : tokens.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">Belum ada token registrasi</td>
                                </tr>
                            ) : (
                                tokens.map((t) => {
                                    const isExpired = t.expiresAt && new Date(t.expiresAt) < new Date();
                                    const isExhausted = t.maxUses !== null && t.usedCount >= t.maxUses;
                                    const isValid = t.isActive && !isExpired && !isExhausted;

                                    return (
                                        <tr key={t.token} className="border-b last:border-0 hover:bg-muted/20">
                                            <td className="p-4 font-medium">{t.description || '-'}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${isValid
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {isValid ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                    {isValid ? 'Aktif' : (isExpired ? 'Kadaluarsa' : !t.isActive ? 'Non-aktif' : 'Habis')}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1">
                                                    <Users className="w-4 h-4 text-muted-foreground" />
                                                    <span>{t.usedCount} / {t.maxUses === null ? '∞' : t.maxUses}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-muted-foreground">
                                                {t.expiresAt ? format(new Date(t.expiresAt), 'dd MMM yyyy HH:mm', { locale: id }) : 'Selamanya'}
                                            </td>
                                            <td className="p-4 text-muted-foreground">
                                                {format(new Date(t.createdAt), 'dd MMM', { locale: id })}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => copyLink(t.token)}
                                                        className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground"
                                                        title="Salin Link"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedToken(t)}
                                                        className="p-2 hover:bg-muted rounded-md text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100"
                                                        title="Lihat QR Code"
                                                    >
                                                        <QrCode className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* QR Modal */}
            {selectedToken && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedToken(null)}>
                    <div className="bg-background rounded-lg p-6 max-w-sm w-full shadow-lg" onClick={e => e.stopPropagation()}>
                        <div className="text-center space-y-4">
                            <h3 className="font-bold text-lg">QR Code Registrasi</h3>
                            <p className="text-sm text-muted-foreground">{selectedToken.description}</p>

                            <div className="p-4 bg-white rounded-lg border inline-block">
                                <QRCode
                                    value={getRegistrationLink(selectedToken.token)}
                                    size={200}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>

                            <p className="text-xs text-muted-foreground break-all px-4">
                                {getRegistrationLink(selectedToken.token)}
                            </p>

                            <div className="flex gap-2 justify-center pt-2">
                                <button
                                    onClick={() => copyLink(selectedToken.token)}
                                    className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-md text-sm font-medium hover:bg-secondary/80"
                                >
                                    <Copy className="w-4 h-4" />
                                    Salin Link
                                </button>
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
                                >
                                    <Printer className="w-4 h-4" />
                                    Print
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminQRGenerator;
