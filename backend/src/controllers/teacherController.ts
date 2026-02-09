import { Request, Response } from 'express';
import { Teacher, User } from '../models';
import bcrypt from 'bcrypt';

export const getAllTeachers = async (req: Request, res: Response): Promise<void> => {
    try {
        const teachers = await Teacher.findAll({
            include: [{ model: User, as: 'user', attributes: ['id', 'username', 'name'] }],
        });

        res.json({ teachers });
    } catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createTeacher = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password, name, employeeId } = req.body;

        if (!username || !password || !name) {
            res.status(400).json({ error: 'Username, password, and name are required' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            password: hashedPassword,
            name,
            role: 'teacher',
        });

        const teacher = await Teacher.create({
            userId: user.id,
            employeeId: employeeId || `EMP${Date.now()}`,
        });

        res.status(201).json({ teacher });
    } catch (error) {
        console.error('Create teacher error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateTeacher = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { employeeId, phone } = req.body;

        const teacher = await Teacher.findByPk(Number(id));

        if (!teacher) {
            res.status(404).json({ error: 'Teacher not found' });
            return;
        }

        await teacher.update({
            employeeId: employeeId || teacher.employeeId,
            phone: phone || teacher.phone,
        });

        res.json({ teacher });
    } catch (error) {
        console.error('Update teacher error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteTeacher = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const teacher = await Teacher.findByPk(Number(id));

        if (!teacher) {
            res.status(404).json({ error: 'Teacher not found' });
            return;
        }

        await teacher.destroy();
        res.json({ message: 'Teacher deleted successfully' });
    } catch (error) {
        console.error('Delete teacher error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
