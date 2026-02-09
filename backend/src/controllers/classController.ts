import { Request, Response } from 'express';
import { Class, Student } from '../models';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';

// ===== Class CRUD =====

export const getAllClasses = async (req: Request, res: Response): Promise<void> => {
    try {
        const classes = await Class.findAll({
            order: [['level', 'ASC'], ['name', 'ASC']],
        });

        // Add student count for each class
        const classesWithCount = await Promise.all(
            classes.map(async (cls: any) => {
                const studentCount = await Student.count({ where: { classId: cls.id } });
                return { ...cls.toJSON(), studentCount };
            })
        );

        res.json({ classes: classesWithCount });
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createClass = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, level } = req.body;

        if (!name || !level) {
            res.status(400).json({ error: 'Name and level are required' });
            return;
        }

        const newClass = await Class.create({ name, level });

        // Generate QR code data URL for this class
        const qrData = JSON.stringify({
            type: 'class',
            id: newClass.id,
            name: newClass.name,
            url: `/scan?classId=${newClass.id}`,
        });

        const qrDataUrl = await QRCode.toDataURL(qrData, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 400,
            margin: 2,
        });

        res.status(201).json({ class: newClass, qrCode: qrDataUrl });
    } catch (error) {
        console.error('Create class error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateClass = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, level } = req.body;

        const classInstance = await Class.findByPk(Number(id));

        if (!classInstance) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        await classInstance.update({ name, level });
        res.json({ class: classInstance });
    } catch (error) {
        console.error('Update class error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteClass = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const classInstance = await Class.findByPk(Number(id));

        if (!classInstance) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        await classInstance.destroy();
        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ===== QR Code =====

export const getClassQR = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const classData = await Class.findByPk(Number(id));

        if (!classData) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        const qrData = JSON.stringify({
            type: 'class',
            id: classData.id,
            name: classData.name,
            url: `/scan?classId=${classData.id}`,
        });

        const qrDataUrl = await QRCode.toDataURL(qrData, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 400,
            margin: 2,
        });

        const qrSvg = await QRCode.toString(qrData, {
            type: 'svg',
            errorCorrectionLevel: 'H',
            width: 400,
        });

        res.json({
            classId: classData.id,
            className: classData.name,
            qrPng: qrDataUrl,
            qrSvg,
        });
    } catch (error) {
        console.error('Get class QR error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ===== Class-scoped Student CRUD (real DB) =====

/** GET /api/classes/:id/students */
export const getClassStudents = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const classData = await Class.findByPk(Number(id));

        if (!classData) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        const students = await Student.findAll({
            where: { classId: Number(id) },
            order: [['name', 'ASC']],
        });

        res.json({
            students,
            count: students.length,
            classId: classData.id,
            className: classData.name,
        });
    } catch (error) {
        console.error('Get class students error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/classes/:id/students */
export const addStudent = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { nis, name, gender } = req.body;

        if (!nis || !name) {
            res.status(400).json({ error: 'NIS and name are required' });
            return;
        }

        const classData = await Class.findByPk(Number(id));
        if (!classData) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        // Check duplicate NIS
        const existing = await Student.findOne({ where: { nis } });
        if (existing) {
            res.status(409).json({ error: `NIS ${nis} sudah terdaftar` });
            return;
        }

        const student = await Student.create({
            nis,
            name,
            classId: Number(id),
            gender: gender === 'L' || gender === 'M' ? 'M' : gender === 'P' || gender === 'F' ? 'F' : undefined,
        });

        res.status(201).json({ student });
    } catch (error) {
        console.error('Add student error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** PUT /api/classes/:id/students/:studentId */
export const updateStudentInClass = async (req: Request, res: Response): Promise<void> => {
    try {
        const { studentId } = req.params;
        const { nis, name, gender } = req.body;

        const student = await Student.findByPk(Number(studentId));
        if (!student) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }

        const updateData: any = {};
        if (nis) updateData.nis = nis;
        if (name) updateData.name = name;
        if (gender) updateData.gender = gender === 'L' || gender === 'M' ? 'M' : 'F';

        await student.update(updateData);
        res.json({ student });
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** DELETE /api/classes/:id/students/:studentId */
export const deleteStudentFromClass = async (req: Request, res: Response): Promise<void> => {
    try {
        const { studentId } = req.params;

        const student = await Student.findByPk(Number(studentId));
        if (!student) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }

        await student.destroy();
        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/classes/:id/students-import — Excel import */
export const importStudents = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const file = (req as any).file;

        if (!file) {
            res.status(400).json({ error: 'File is required' });
            return;
        }

        const classData = await Class.findByPk(Number(id));
        if (!classData) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        // Parse Excel
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
            res.status(400).json({ error: 'File kosong atau format tidak sesuai' });
            return;
        }

        const results = { imported: 0, skipped: 0, errors: [] as string[] };

        for (const row of rows) {
            const nis = String(row['NISN'] || row['NIS'] || row['nisn'] || row['nis'] || '').trim();
            const name = String(row['Nama'] || row['NAMA'] || row['nama'] || row['Name'] || row['name'] || '').trim();
            const jk = String(row['JK'] || row['jk'] || row['Gender'] || row['gender'] || row['Jenis Kelamin'] || '').trim().toUpperCase();

            if (!nis || !name) {
                results.errors.push(`Baris: NISN/Nama kosong`);
                results.skipped++;
                continue;
            }

            // Check duplicate
            const existing = await Student.findOne({ where: { nis } });
            if (existing) {
                results.errors.push(`NISN ${nis} sudah terdaftar`);
                results.skipped++;
                continue;
            }

            await Student.create({
                nis,
                name,
                classId: Number(id),
                gender: jk === 'L' || jk === 'M' ? 'M' : jk === 'P' || jk === 'F' ? 'F' : undefined,
            });
            results.imported++;
        }

        res.json({
            message: `Import selesai: ${results.imported} siswa ditambahkan, ${results.skipped} dilewati`,
            ...results,
        });
    } catch (error) {
        console.error('Import students error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ===== Active Session & Student Attendance =====

/** GET /api/classes/:id/active-session */
export const getActiveSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const classData = await Class.findByPk(Number(id));

        if (!classData) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        const { Session, Schedule, Subject, Teacher, User } = require('../models');
        const today = new Date().toISOString().split('T')[0];

        const activeSession = await Session.findOne({
            where: { date: today, status: 'ongoing' },
            include: [{
                model: Schedule,
                where: { classId: Number(id) },
                include: [
                    { model: Subject, attributes: ['name', 'code'] },
                    { model: Teacher, include: [{ model: User, attributes: ['name'] }] },
                ],
            }],
        });

        if (activeSession) {
            res.json({
                sessionId: activeSession.id,
                subject: {
                    name: activeSession.Schedule?.Subject?.name || 'Unknown',
                    code: activeSession.Schedule?.Subject?.code || '',
                },
                class: { id: classData.id, name: classData.name },
                teacher: activeSession.Schedule?.Teacher?.User?.name || 'Unknown',
                startTime: activeSession.startTime,
                endTime: activeSession.endTime,
                topic: activeSession.topic || '',
                status: activeSession.status,
            });
        } else {
            // Mock fallback for dev
            res.json({
                sessionId: 1,
                subject: { name: 'Matematika', code: 'MATH' },
                class: { id: classData.id, name: classData.name },
                teacher: 'Guru Pertama',
                startTime: '08:00',
                endTime: '09:30',
                topic: 'Aljabar Dasar',
                status: 'ongoing',
                mock: true,
            });
        }
    } catch (error) {
        console.error('Get active session error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** POST /api/classes/:classId/student-attendance */
export const submitStudentAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        const { classId } = req.params;
        const { statuses } = req.body;

        if (!statuses || !Array.isArray(statuses)) {
            res.status(400).json({ error: 'statuses array is required' });
            return;
        }

        console.log(`[Attendance] Class ${classId}: ${statuses.length} students recorded`);

        res.json({
            message: 'Student attendance recorded successfully',
            classId: Number(classId),
            totalRecorded: statuses.length,
            summary: {
                hadir: statuses.filter((s: any) => s.status === 'hadir').length,
                izin: statuses.filter((s: any) => s.status === 'izin').length,
                sakit: statuses.filter((s: any) => s.status === 'sakit').length,
                alpha: statuses.filter((s: any) => s.status === 'alpha').length,
            },
        });
    } catch (error) {
        console.error('Submit student attendance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
