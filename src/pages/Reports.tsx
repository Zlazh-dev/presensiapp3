import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Download, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

const Reports = () => {
    const { attendance, teachers, students } = useApp();
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

    const filteredAttendance = attendance.filter(a => a.date === filterDate);

    const handleExport = () => {
        // Generate CSV content
        const headers = ['Date', 'Time', 'Name', 'Type', 'Status'];
        const rows = filteredAttendance.map(record => {
            const user = record.userType === 'teacher'
                ? teachers.find(t => t.id === record.userId)
                : students.find(s => s.id === record.userId);
            return [
                record.date,
                record.checkInTime,
                user?.name || 'Unknown',
                record.userType,
                record.status
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(',') + "\n"
            + rows.join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `attendance_report_${filterDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Laporan Presensi</h1>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-[160px]"
                        />
                    </div>
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Log Presensi ({format(new Date(filterDate), 'dd MMMM yyyy')})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Waktu</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nama</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tipe</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {filteredAttendance.length > 0 ? filteredAttendance.map((record) => {
                                    const user = record.userType === 'teacher'
                                        ? teachers.find(t => t.id === record.userId)
                                        : students.find(s => s.id === record.userId);
                                    return (
                                        <tr key={record.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <td className="p-4 align-middle">{record.checkInTime}</td>
                                            <td className="p-4 align-middle font-medium">{user?.name}</td>
                                            <td className="p-4 align-middle capitalize">{record.userType}</td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                                ${record.status === 'Hadir' ? 'bg-green-100 text-green-800' :
                                                        record.status === 'Sakit' ? 'bg-yellow-100 text-yellow-800' :
                                                            record.status === 'Izin' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-red-100 text-red-800'}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                                            Tidak ada data presensi pada tanggal ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Reports;
