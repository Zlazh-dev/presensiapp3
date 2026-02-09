import { Request, Response } from 'express';
import { Student, Class } from '../models';

export const getAllStudents = async (req: Request, res: Response): Promise<void> => {
    try {
        const { classId } = req.query;
        const where = classId ? { classId: parseInt(classId as string) } : {};

        console.log('[GET /api/students] Fetching students with filter:', where);

        const students = await Student.findAll({
            where,
            include: [{
                model: Class,
                as: 'class',
                required: false // LEFT JOIN instead of INNER JOIN
            }],
            order: [['name', 'ASC']],
        });

        console.log(`[GET /api/students] Found ${students.length} students`);
        res.json({ students });
    } catch (error) {
        console.error('[GET /api/students] Error:', error);
        console.error('[GET /api/students] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
        });
    }
};

export const createStudent = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nis, name, classId } = req.body;

        if (!nis || !name || !classId) {
            res.status(400).json({ error: 'NIS, name, and classId are required' });
            return;
        }

        const student = await Student.create({ nis, name, classId });
        res.status(201).json({ student });
    } catch (error) {
        console.error('Create student error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateStudent = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { nis, name, classId } = req.body;

        const student = await Student.findByPk(Number(id));

        if (!student) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }

        await student.update({ nis, name, classId });
        res.json({ student });
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteStudent = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const student = await Student.findByPk(Number(id));

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
