import { Response } from 'express';
import { Attendance, User, Student, Teacher, Class } from '../models';
import { AuthRequest } from '../middlewares/auth';
import { createObjectCsvWriter } from 'csv-writer';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export const exportCSV = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            res.status(400).json({ error: 'Start date and end date are required' });
            return;
        }

        const attendance = await Attendance.findAll({
            where: {
                date: {
                    $between: [startDate, endDate],
                },
            },
            order: [['date', 'ASC'], ['checkInTime', 'ASC']],
        });

        // Prepare data with user names
        const data = await Promise.all(
            attendance.map(async (record) => {
                let userName = 'Unknown';

                if (record.userType === 'teacher') {
                    const teacher = await Teacher.findOne({
                        where: { userId: record.userId },
                        include: [{ model: User, as: 'user' }],
                    });
                    userName = teacher?.user?.name || 'Unknown';
                } else {
                    const student = await Student.findByPk(record.userId);
                    userName = student?.name || 'Unknown';
                }

                return {
                    date: record.date,
                    name: userName,
                    type: record.userType,
                    status: record.status,
                    checkInTime: record.checkInTime || '-',
                    checkOutTime: record.checkOutTime || '-',
                };
            })
        );

        // Create CSV
        const filename = `attendance_${startDate}_to_${endDate}.csv`;
        const filepath = path.join(__dirname, '..', '..', 'exports', filename);

        // Ensure exports directory exists
        if (!fs.existsSync(path.dirname(filepath))) {
            fs.mkdirSync(path.dirname(filepath), { recursive: true });
        }

        const csvWriter = createObjectCsvWriter({
            path: filepath,
            header: [
                { id: 'date', title: 'Date' },
                { id: 'name', title: 'Name' },
                { id: 'type', title: 'Type' },
                { id: 'status', title: 'Status' },
                { id: 'checkInTime', title: 'Check In' },
                { id: 'checkOutTime', title: 'Check Out' },
            ],
        });

        await csvWriter.writeRecords(data);

        res.download(filepath, filename, (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // Clean up file after download
            fs.unlinkSync(filepath);
        });
    } catch (error) {
        console.error('Export CSV error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const exportXLSX = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            res.status(400).json({ error: 'Start date and end date are required' });
            return;
        }

        const attendance = await Attendance.findAll({
            where: {
                date: {
                    $between: [startDate, endDate],
                },
            },
            order: [['date', 'ASC'], ['checkInTime', 'ASC']],
        });

        // Prepare data
        const data = await Promise.all(
            attendance.map(async (record) => {
                let userName = 'Unknown';

                if (record.userType === 'teacher') {
                    const teacher = await Teacher.findOne({
                        where: { userId: record.userId },
                        include: [{ model: User, as: 'user' }],
                    });
                    userName = teacher?.user?.name || 'Unknown';
                } else {
                    const student = await Student.findByPk(record.userId);
                    userName = student?.name || 'Unknown';
                }

                return {
                    date: record.date,
                    name: userName,
                    type: record.userType,
                    status: record.status,
                    checkInTime: record.checkInTime || '-',
                    checkOutTime: record.checkOutTime || '-',
                };
            })
        );

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance Report');

        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Type', key: 'type', width: 10 },
            { header: 'Status', key: 'status', width: 10 },
            { header: 'Check In', key: 'checkInTime', width: 15 },
            { header: 'Check Out', key: 'checkOutTime', width: 15 },
        ];

        worksheet.addRows(data);

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
        };

        const filename = `attendance_${startDate}_to_${endDate}.xlsx`;
        const filepath = path.join(__dirname, '..', '..', 'exports', filename);

        // Ensure exports directory exists
        if (!fs.existsSync(path.dirname(filepath))) {
            fs.mkdirSync(path.dirname(filepath), { recursive: true });
        }

        await workbook.xlsx.writeFile(filepath);

        res.download(filepath, filename, (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // Clean up file after download
            fs.unlinkSync(filepath);
        });
    } catch (error) {
        console.error('Export XLSX error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
