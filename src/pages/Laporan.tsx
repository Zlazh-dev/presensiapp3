import React, { useState } from 'react';
import { FileText, Download, Calendar, FileSpreadsheet, Printer } from 'lucide-react';

const Laporan: React.FC = () => {
    const [reportType, setReportType] = useState<'guru' | 'siswa'>('guru');
    const [dateRange, setDateRange] = useState({ start: '2026-02-01', end: '2026-02-28' });
    const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');

    const handleExport = () => {
        alert(`Mengekspor laporan ${reportType} (${dateRange.start} - ${dateRange.end}) sebagai ${format.toUpperCase()}`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-7 h-7 text-cyan-600" />
                    Laporan
                </h1>
                <p className="text-gray-500 mt-1">Generate dan ekspor laporan kehadiran</p>
            </div>

            {/* Report Generator Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 mb-6">Generate Laporan</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Report Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Laporan</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setReportType('guru')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${reportType === 'guru'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Guru
                            </button>
                            <button
                                onClick={() => setReportType('siswa')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${reportType === 'siswa'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Siswa
                            </button>
                        </div>
                    </div>

                    {/* Date Range */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Mulai</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Selesai</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    {/* Format */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFormat('pdf')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${format === 'pdf'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                <Printer className="w-4 h-4" />
                                PDF
                            </button>
                            <button
                                onClick={() => setFormat('excel')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${format === 'excel'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                Excel
                            </button>
                        </div>
                    </div>
                </div>

                {/* Export Button */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
                    >
                        <Download className="w-5 h-5" />
                        Export Laporan
                    </button>
                </div>
            </div>

            {/* Recent Reports */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Laporan Terakhir</h2>
                <div className="space-y-3">
                    {[
                        { name: 'Laporan Kehadiran Guru Februari 2026.pdf', date: '2026-02-05', size: '245 KB' },
                        { name: 'Laporan Kehadiran Siswa Januari 2026.xlsx', date: '2026-02-01', size: '1.2 MB' },
                        { name: 'Rekap Bulanan Desember 2025.pdf', date: '2026-01-02', size: '380 KB' },
                    ].map((report, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${report.name.endsWith('.pdf') ? 'bg-red-50' : 'bg-green-50'}`}>
                                    {report.name.endsWith('.pdf') ? (
                                        <FileText className={`w-5 h-5 text-red-600`} />
                                    ) : (
                                        <FileSpreadsheet className={`w-5 h-5 text-green-600`} />
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{report.name}</p>
                                    <p className="text-xs text-gray-500">{report.date} • {report.size}</p>
                                </div>
                            </div>
                            <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Laporan;
