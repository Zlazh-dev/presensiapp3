import { Response } from 'express';
import { Op } from 'sequelize';
import { TeacherAttendance, StudentAttendance, User, Student, Teacher, Class, Session, Schedule, Subject } from '../models';
import { AuthRequest } from '../middlewares/auth';
import * as XLSX from 'xlsx';

/**
 * Helper: Gather combined attendance data for a date range
 * Returns teacher + student attendance rows with proper labels
 */
const getAttendanceData = async (startDate: string, endDate: string) => {
    // === Teacher Regular Attendance ===
    const teacherRecords = await TeacherAttendance.findAll({
        where: {
            date: { [Op.between]: [startDate, endDate] },
            sessionId: { [Op.is]: null as any },
        },
        include: [{
            model: Teacher,
            as: 'teacher',
            include: [{ model: User, as: 'user', attributes: ['name'] }],
        }],
        order: [['date', 'ASC'], ['createdAt', 'ASC']],
    });

    const teacherRows = teacherRecords.map((r: any) => ({
        Tanggal: r.date,
        Nama: r.teacher?.user?.name || 'Unknown',
        Tipe: 'Guru',
        Kategori: 'Reguler',
        Status: getStatusLabel(r.status),
        'Jam Masuk': r.checkInTime || '-',
        'Jam Keluar': r.checkOutTime || '-',
        Keterangan: r.notes || '-',
    }));

    // === Teacher Session Attendance ===
    const sessionRecords = await TeacherAttendance.findAll({
        where: {
            date: { [Op.between]: [startDate, endDate] },
            sessionId: { [Op.ne]: null as any },
        },
        include: [
            {
                model: Teacher,
                as: 'teacher',
                include: [{ model: User, as: 'user', attributes: ['name'] }],
            },
            {
                model: Session,
                as: 'session',
                include: [{
                    model: Schedule,
                    as: 'schedule',
                    include: [
                        { model: Class, as: 'class', attributes: ['name'] },
                        { model: Subject, as: 'subject', attributes: ['name'] },
                    ],
                }],
            },
        ],
        order: [['date', 'ASC'], ['createdAt', 'ASC']],
    });

    const sessionRows = sessionRecords.map((r: any) => ({
        Tanggal: r.date,
        Nama: r.teacher?.user?.name || 'Unknown',
        Tipe: 'Guru',
        Kategori: `Sesi: ${r.session?.schedule?.class?.name || '?'} - ${r.session?.schedule?.subject?.name || '?'}`,
        Status: getStatusLabel(r.status),
        'Jam Masuk': r.checkInTime || '-',
        'Jam Keluar': r.checkOutTime || '-',
        Keterangan: r.notes || '-',
    }));

    // === Student Attendance ===
    const studentRecords = await StudentAttendance.findAll({
        where: {
            createdAt: { [Op.between]: [`${startDate}T00:00:00`, `${endDate}T23:59:59`] },
        },
        include: [
            {
                model: Student,
                as: 'student',
                attributes: ['id', 'name', 'nis'],
                include: [{ model: Class, as: 'class', attributes: ['name'] }],
            },
            {
                model: Session,
                as: 'session',
                attributes: ['id', 'date'],
                include: [{
                    model: Schedule,
                    as: 'schedule',
                    include: [{ model: Subject, as: 'subject', attributes: ['name'] }],
                }],
            },
        ],
        order: [['createdAt', 'ASC']],
    });

    const studentRows = studentRecords.map((r: any) => ({
        Tanggal: r.session?.date || '-',
        Nama: `${r.student?.name || 'Unknown'} (${r.student?.nis || '-'})`,
        Tipe: 'Siswa',
        Kategori: `${r.student?.class?.name || '?'} - ${r.session?.schedule?.subject?.name || '?'}`,
        Status: getStatusLabel(r.status),
        'Jam Masuk': '-',
        'Jam Keluar': '-',
        Keterangan: r.notes || '-',
    }));

    return [...teacherRows, ...sessionRows, ...studentRows];
};

const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        present: 'Hadir',
        late: 'Terlambat',
        sick: 'Sakit',
        permission: 'Izin',
        alpha: 'Alpha',
        absent: 'Absent',
    };
    return labels[status] || status;
};

/**
 * Export attendance as CSV
 * GET /api/reports/attendance/csv?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const exportCSV = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            res.status(400).json({ error: 'Start date and end date are required' });
            return;
        }

        const data = await getAttendanceData(startDate as string, endDate as string);

        // Create workbook with xlsx and convert to CSV
        const ws = XLSX.utils.json_to_sheet(data);
        const csv = XLSX.utils.sheet_to_csv(ws);

        const filename = `rekap_kehadiran_${startDate}_${endDate}.csv`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.send(csv);

    } catch (error) {
        console.error('Export CSV error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Export attendance as XLSX
 * GET /api/reports/attendance/xlsx?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const exportXLSX = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            res.status(400).json({ error: 'Start date and end date are required' });
            return;
        }

        const data = await getAttendanceData(startDate as string, endDate as string);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // Set column widths
        ws['!cols'] = [
            { wch: 12 },  // Tanggal
            { wch: 28 },  // Nama
            { wch: 8 },   // Tipe
            { wch: 25 },  // Kategori
            { wch: 12 },  // Status
            { wch: 10 },  // Jam Masuk
            { wch: 10 },  // Jam Keluar
            { wch: 30 },  // Keterangan
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Kehadiran');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const filename = `rekap_kehadiran_${startDate}_${endDate}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Export XLSX error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
