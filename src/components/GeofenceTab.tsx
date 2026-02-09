import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Save, Loader2, MapPin, Navigation, CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────
interface GeofenceData {
    id: number | null;
    label: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    isActive: boolean;
}

interface TestResult {
    inside: boolean;
    distance: number;
}

const API = '/api';
const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

// ─── Leaflet CDN loader ──────────────────────────────
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

let leafletLoaded = false;
const loadLeaflet = (): Promise<void> => {
    if (leafletLoaded && (window as any).L) return Promise.resolve();
    return new Promise((resolve, reject) => {
        // CSS
        if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = LEAFLET_CSS;
            document.head.appendChild(link);
        }
        // JS
        if ((window as any).L) { leafletLoaded = true; resolve(); return; }
        const script = document.createElement('script');
        script.src = LEAFLET_JS;
        script.onload = () => { leafletLoaded = true; resolve(); };
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

// ─── Haversine (client-side for Test Lokasi) ─────────
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─────────────────────────────────────────────────────
const GeofenceTab: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [label, setLabel] = useState('Sekolah');
    const [latitude, setLatitude] = useState(-7.936);
    const [longitude, setLongitude] = useState(112.629);
    const [radiusMeters, setRadiusMeters] = useState(100);

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const circleRef = useRef<any>(null);

    // ─── Fetch geofence config ───
    useEffect(() => {
        const fetchGeofence = async () => {
            try {
                const res = await fetch(`${API}/geofence`, { headers: getHeaders() });
                if (res.ok) {
                    const data: GeofenceData = await res.json();
                    setLabel(data.label || 'Sekolah');
                    setLatitude(Number(data.latitude));
                    setLongitude(Number(data.longitude));
                    setRadiusMeters(data.radiusMeters);
                }
            } catch (e) {
                console.error('Fetch geofence failed:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchGeofence();
    }, []);

    // ─── Update map markers/circle ───
    const updateMapView = useCallback((lat: number, lng: number, radius: number) => {
        const L = (window as any).L;
        if (!L || !mapInstanceRef.current) return;

        if (markerRef.current) mapInstanceRef.current.removeLayer(markerRef.current);
        if (circleRef.current) mapInstanceRef.current.removeLayer(circleRef.current);

        markerRef.current = L.marker([lat, lng], { draggable: true })
            .addTo(mapInstanceRef.current)
            .bindPopup(`<b>${label}</b><br>Radius: ${radius}m`)
            .openPopup();

        markerRef.current.on('dragend', (e: any) => {
            const pos = e.target.getLatLng();
            setLatitude(parseFloat(pos.lat.toFixed(7)));
            setLongitude(parseFloat(pos.lng.toFixed(7)));
        });

        circleRef.current = L.circle([lat, lng], {
            radius,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 2,
        }).addTo(mapInstanceRef.current);

        mapInstanceRef.current.setView([lat, lng], 17);
    }, [label]);

    // ─── Init Leaflet map ───
    useEffect(() => {
        if (loading) return;
        let cancelled = false;

        const init = async () => {
            await loadLeaflet();
            if (cancelled || !mapRef.current) return;
            const L = (window as any).L;

            // Destroy previous map instance
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }

            const map = L.map(mapRef.current).setView([latitude, longitude], 17);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19,
            }).addTo(map);

            mapInstanceRef.current = map;
            updateMapView(latitude, longitude, radiusMeters);

            // Click to move marker
            map.on('click', (e: any) => {
                setLatitude(parseFloat(e.latlng.lat.toFixed(7)));
                setLongitude(parseFloat(e.latlng.lng.toFixed(7)));
            });
        };

        init();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    // ─── Update map on lat/lng/radius change ───
    useEffect(() => {
        if (!loading && mapInstanceRef.current) {
            updateMapView(latitude, longitude, radiusMeters);
        }
    }, [latitude, longitude, radiusMeters, loading, updateMapView]);

    // ─── Save ───
    const handleSave = async () => {
        setError('');
        setSuccess('');
        if (radiusMeters < 10 || radiusMeters > 10000) {
            setError('Radius harus antara 10–10000 meter');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`${API}/geofence`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ label, latitude, longitude, radiusMeters }),
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Gagal menyimpan');
                return;
            }
            setSuccess('Geofence berhasil disimpan!');
            setTimeout(() => setSuccess(''), 3000);
        } catch {
            setError('Gagal menyimpan geofence');
        } finally {
            setSaving(false);
        }
    };

    // ─── Test Location ───
    const handleTestLocation = () => {
        setTesting(true);
        setTestResult(null);
        setError('');

        if (!navigator.geolocation) {
            setError('Geolocation tidak didukung di browser ini');
            setTesting(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const distance = haversine(
                    pos.coords.latitude, pos.coords.longitude,
                    latitude, longitude
                );
                setTestResult({
                    inside: distance <= radiusMeters,
                    distance: Math.round(distance),
                });
                setTesting(false);
            },
            (err) => {
                setError(`Gagal mendapatkan lokasi: ${err.message}`);
                setTesting(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-500" />
                <p className="text-gray-500 text-sm mt-2">Memuat data geofence...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Pengaturan Geofence
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                    Tentukan area sekolah. Presensi hanya bisa dilakukan di dalam radius geofence.
                </p>
            </div>

            {/* Alerts */}
            {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 p-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    {success}
                </div>
            )}

            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <div ref={mapRef} style={{ height: 360, width: '100%' }} />
            </div>
            <p className="text-xs text-gray-400">
                Klik pada peta atau seret marker untuk mengubah titik pusat. Lingkaran biru menunjukkan area radius geofence.
            </p>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                    <input
                        type="text"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input
                        type="number"
                        step="0.0000001"
                        value={latitude}
                        onChange={e => setLatitude(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input
                        type="number"
                        step="0.0000001"
                        value={longitude}
                        onChange={e => setLongitude(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Radius (meter)</label>
                    <input
                        type="number"
                        min={10}
                        max={10000}
                        value={radiusMeters}
                        onChange={e => setRadiusMeters(parseInt(e.target.value) || 100)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Simpan Geofence
                </button>

                <button
                    onClick={handleTestLocation}
                    disabled={testing}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm disabled:opacity-50"
                >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                    Test Lokasi Saya
                </button>
            </div>

            {/* Test Result */}
            {testResult && (
                <div
                    className={`flex items-center gap-3 p-4 rounded-xl border ${testResult.inside
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                >
                    {testResult.inside ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                        <p className="font-semibold">
                            {testResult.inside ? 'Di dalam area geofence' : 'Di luar area geofence'}
                        </p>
                        <p className="text-sm mt-0.5">
                            Jarak Anda: <strong>{testResult.distance}m</strong> dari titik pusat
                            {!testResult.inside && ` (max ${radiusMeters}m)`}
                        </p>
                    </div>
                </div>
            )}

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                    <p className="font-medium">Geofence memblokir presensi di luar area</p>
                    <p className="mt-0.5 text-blue-600">
                        Guru dan siswa harus berada di dalam radius {radiusMeters}m dari titik sekolah saat scan presensi.
                        Scan dari luar area akan ditolak secara otomatis.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GeofenceTab;
