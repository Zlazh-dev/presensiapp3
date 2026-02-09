import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Loader2, Camera, RefreshCw, AlertCircle } from 'lucide-react';

interface ScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanFailure?: (error: any) => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScanSuccess, onScanFailure }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cameras, setCameras] = useState<any[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        // 1. Get Cameras
        const getCameras = async () => {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length) {
                    setCameras(devices);
                    // Default to the last camera (usually back camera on mobile)
                    setSelectedCameraId(devices[devices.length - 1].id);
                } else {
                    setError("Tidak ada kamera yang ditemukan.");
                }
            } catch (err: any) {
                console.error("Error getting cameras", err);
                setError("Gagal mengakses kamera. Pastikan izin diberikan.");
            } finally {
                setIsLoading(false);
            }
        };

        getCameras();

        return () => {
            // Cleanup: stop scanner if running
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(err => console.error("Failed to stop scanner cleanup", err));
            }
        };
    }, []);

    // 2. Start Scanner when camera is selected
    useEffect(() => {
        if (selectedCameraId && !isScanning) {
            startScanner(selectedCameraId);
        }
    }, [selectedCameraId]);

    const startScanner = async (cameraId: string) => {
        // Ensure previous instance is stopped
        if (scannerRef.current?.isScanning) {
            try {
                await scannerRef.current.stop();
            } catch (ignore) { }
        }

        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        setIsLoading(true);
        setError(null);

        try {
            await html5QrCode.start(
                cameraId,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                (decodedText) => {
                    handleSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignore transient errors
                }
            );
            setIsScanning(true);
        } catch (err: any) {
            console.error("Failed to start scanner", err);
            setError(`Gagal memulai kamera: ${err.message || err}`);
            setIsScanning(false);
            if (onScanFailure) onScanFailure(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccess = (decodedText: string) => {
        // Stop scanning after success
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
                setIsScanning(false);
            }).catch(console.error);
        }
        onScanSuccess(decodedText);
    };

    const handleRetry = () => {
        if (selectedCameraId) {
            startScanner(selectedCameraId);
        } else {
            window.location.reload();
        }
    };

    return (
        <div className="w-full max-w-md mx-auto relative rounded-xl overflow-hidden bg-black min-h-[300px] flex flex-col justify-center items-center">
            {/* Camera Viewport */}
            <div id="reader" className="w-full h-full absolute inset-0 bg-black"></div>

            {/* Overlays */}
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 text-white">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                    <p>Membuka kamera...</p>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 text-white p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <p className="mb-4">{error}</p>
                    <button
                        onClick={handleRetry}
                        className="px-6 py-2 bg-blue-600 rounded-full font-bold flex items-center gap-2 hover:bg-blue-700 active:scale-95 transition-all"
                    >
                        <RefreshCw className="w-4 h-4" /> Coba Lagi
                    </button>
                </div>
            )}

            {!isScanning && !isLoading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 text-white">
                    <p className="mb-4 text-gray-300">Kamera tidak aktif</p>
                    <button
                        onClick={() => selectedCameraId && startScanner(selectedCameraId)}
                        className="px-6 py-3 bg-green-600 rounded-full font-bold flex items-center gap-2 hover:bg-green-700 active:scale-95 transition-all"
                    >
                        <Camera className="w-5 h-5" /> Mulai Kamera
                    </button>
                </div>
            )}

            {/* Scanner Controls / Overlay UI */}
            {isScanning && (
                <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-2 px-4">
                    {cameras.length > 1 && (
                        <select
                            className="bg-black/50 text-white text-sm px-3 py-1 rounded-full border border-white/20 outline-none"
                            value={selectedCameraId || ''}
                            onChange={(e) => setSelectedCameraId(e.target.value)}
                        >
                            {cameras.map(cam => (
                                <option key={cam.id} value={cam.id}>
                                    {cam.label || `Camera ${cam.id.substr(0, 5)}...`}
                                </option>
                            ))}
                        </select>
                    )}
                    <div className="bg-black/50 text-white text-xs px-3 py-1 rounded-full border border-white/20 animate-pulse">
                        Scanning...
                    </div>
                </div>
            )}
        </div>
    );
};

export default Scanner;
