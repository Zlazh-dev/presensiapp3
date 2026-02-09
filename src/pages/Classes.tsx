import { useState } from 'react';
import { useApp, type Class } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Plus, Users, QrCode, Edit, Trash2, Download, Printer } from 'lucide-react';
import QRCode from 'react-qr-code';

const Classes = () => {
    const { classes, students } = useApp();
    const [selectedClassForQR, setSelectedClassForQR] = useState<Class | null>(null);
    const [showTeacherRoomQR, setShowTeacherRoomQR] = useState(false);

    const downloadQR = (filename: string) => {
        const svg = document.getElementById('qr-code-svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL('image/png');

            const downloadLink = document.createElement('a');
            downloadLink.download = filename;
            downloadLink.href = pngFile;
            downloadLink.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Manajemen Kelas</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowTeacherRoomQR(true)}>
                        <QrCode className="mr-2 h-4 w-4" />
                        QR Ruang Guru
                    </Button>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Kelas
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {classes.map((cls) => {
                    const studentCount = students.filter((s) => s.classId === cls.id).length;
                    return (
                        <Card key={cls.id} className="relative overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center justify-between">
                                    <span>Kelas {cls.name}</span>
                                    <span className="text-xs font-normal text-muted-foreground border px-2 py-0.5 rounded-full">
                                        Level {cls.level}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center text-sm text-muted-foreground mb-4">
                                    <Users className="mr-2 h-4 w-4" />
                                    {studentCount} Siswa
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => setSelectedClassForQR(cls)}
                                    >
                                        <QrCode className="mr-2 h-4 w-4" />
                                        QR Code
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-9 w-9">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Class QR Modal */}
            <Modal
                isOpen={!!selectedClassForQR}
                onClose={() => setSelectedClassForQR(null)}
                title={`QR Code Kelas ${selectedClassForQR?.name}`}
                className="max-w-md"
            >
                <div className="flex flex-col items-center justify-center p-4 space-y-4">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        {selectedClassForQR && (
                            <QRCode
                                id="qr-code-svg"
                                value={JSON.stringify({
                                    type: 'class',
                                    id: selectedClassForQR.id,
                                    name: selectedClassForQR.name,
                                })}
                                size={256}
                            />
                        )}
                    </div>

                    <div className="text-center space-y-2">
                        <p className="text-lg font-semibold">
                            Kelas {selectedClassForQR?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Scan QR ini untuk melakukan presensi di kelas ini
                        </p>
                    </div>

                    <div className="flex gap-2 w-full">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() =>
                                downloadQR(`QR-Kelas-${selectedClassForQR?.name}.png`)
                            }
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </Button>
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => window.print()}
                        >
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        Tempel QR code ini di pintu kelas atau papan pengumuman
                    </p>
                </div>
            </Modal>

            {/* Teacher Room QR Modal */}
            <Modal
                isOpen={showTeacherRoomQR}
                onClose={() => setShowTeacherRoomQR(false)}
                title="QR Code Ruang Guru"
                className="max-w-md"
            >
                <div className="flex flex-col items-center justify-center p-4 space-y-4">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <QRCode
                            id="qr-code-svg"
                            value={JSON.stringify({
                                type: 'place',
                                place: 'teacher-room',
                                name: 'Ruang Guru',
                            })}
                            size={256}
                        />
                    </div>

                    <div className="text-center space-y-2">
                        <p className="text-lg font-semibold">Ruang Guru</p>
                        <p className="text-sm text-muted-foreground">
                            Scan QR ini untuk melakukan presensi di ruang guru
                        </p>
                    </div>

                    <div className="flex gap-2 w-full">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => downloadQR('QR-Ruang-Guru.png')}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </Button>
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => window.print()}
                        >
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        Tempel QR code ini di pintu ruang guru
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default Classes;
