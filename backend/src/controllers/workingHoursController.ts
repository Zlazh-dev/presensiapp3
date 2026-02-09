import { Request, Response } from 'express';
import { Op } from 'sequelize';

const getModels = () => {
    const { TeacherWorkingHours } = require('../models');
    const Teacher = require('../models/Teacher').default;
    const User = require('../models/User').default;
    return { TeacherWorkingHours, Teacher, User };
};

const DAY_LABELS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

// GET /api/working-hours  — all working hours, grouped by teacher
// Now includes ALL teachers, even those without working hours entries
export const getAllWorkingHours = async (_req: Request, res: Response): Promise<void> => {
    try {
        const { TeacherWorkingHours, Teacher, User } = getModels();

        // First, get ALL teachers
        const allTeachers = await Teacher.findAll({
            include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
            order: [['id', 'ASC']],
        });

        // Then get all working hours
        const rows = await TeacherWorkingHours.findAll({
            order: [['teacherId', 'ASC'], ['dayOfWeek', 'ASC']],
        });

        // Initialize map with ALL teachers (even those without working hours)
        const byTeacher = new Map<number, any>();
        for (const teacher of allTeachers as any[]) {
            byTeacher.set(teacher.id, {
                teacherId: teacher.id,
                teacherName: teacher.user?.name || 'Unknown',
                employeeId: teacher.employeeId || '',
                days: [],
            });
        }

        // Add working hours to the corresponding teachers
        for (const row of rows as any[]) {
            const tid = row.teacherId;
            if (byTeacher.has(tid)) {
                byTeacher.get(tid)!.days.push({
                    id: row.id,
                    dayOfWeek: row.dayOfWeek,
                    dayLabel: DAY_LABELS[row.dayOfWeek],
                    startTime: row.startTime,
                    endTime: row.endTime,
                    toleranceBeforeMin: row.toleranceBeforeMin,
                    lateAfterMin: row.lateAfterMin,
                });
            }
        }

        res.json({ workingHours: Array.from(byTeacher.values()) });
    } catch (error) {
        console.error('Get working hours error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /api/working-hours/:teacherId — working hours for one teacher
export const getTeacherWorkingHours = async (req: Request, res: Response): Promise<void> => {
    try {
        const { TeacherWorkingHours } = getModels();
        const { teacherId } = req.params;

        const rows = await TeacherWorkingHours.findAll({
            where: { teacherId: Number(teacherId) },
            order: [['dayOfWeek', 'ASC']],
        });

        res.json({
            days: rows.map((r: any) => ({
                id: r.id,
                dayOfWeek: r.dayOfWeek,
                dayLabel: DAY_LABELS[r.dayOfWeek],
                startTime: r.startTime,
                endTime: r.endTime,
            })),
        });
    } catch (error) {
        console.error('Get teacher working hours error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /api/working-hours — create or bulk-upsert working hours
export const createWorkingHours = async (req: Request, res: Response): Promise<void> => {
    try {
        const { TeacherWorkingHours } = getModels();
        const { teacherId, dayOfWeek, startTime, endTime } = req.body;

        if (!teacherId || !dayOfWeek || !startTime || !endTime) {
            res.status(400).json({ error: 'teacherId, dayOfWeek, startTime, endTime are required' });
            return;
        }

        const [record, created] = await TeacherWorkingHours.findOrCreate({
            where: { teacherId, dayOfWeek },
            defaults: { teacherId, dayOfWeek, startTime, endTime },
        });

        if (!created) {
            await record.update({ startTime, endTime });
        }

        res.status(created ? 201 : 200).json({
            message: created ? 'Working hours created' : 'Working hours updated',
            workingHours: record,
        });
    } catch (error) {
        console.error('Create working hours error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// PUT /api/working-hours/:id — update a specific record
export const updateWorkingHours = async (req: Request, res: Response): Promise<void> => {
    try {
        const { TeacherWorkingHours } = getModels();
        const { id } = req.params;
        const { startTime, endTime, toleranceBeforeMin, lateAfterMin } = req.body;

        const record = await TeacherWorkingHours.findByPk(Number(id));
        if (!record) {
            res.status(404).json({ error: 'Working hours record not found' });
            return;
        }

        const updateData: any = {};
        if (startTime !== undefined) updateData.startTime = startTime;
        if (endTime !== undefined) updateData.endTime = endTime;
        if (toleranceBeforeMin !== undefined) updateData.toleranceBeforeMin = toleranceBeforeMin;
        if (lateAfterMin !== undefined) updateData.lateAfterMin = lateAfterMin;

        await record.update(updateData);
        res.json({ message: 'Working hours updated', workingHours: record });
    } catch (error) {
        console.error('Update working hours error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// DELETE /api/working-hours/:id — remove a specific day
export const deleteWorkingHours = async (req: Request, res: Response): Promise<void> => {
    try {
        const { TeacherWorkingHours } = getModels();
        const { id } = req.params;

        const record = await TeacherWorkingHours.findByPk(Number(id));
        if (!record) {
            res.status(404).json({ error: 'Working hours record not found' });
            return;
        }

        await record.destroy();
        res.json({ message: 'Working hours deleted' });
    } catch (error) {
        console.error('Delete working hours error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// PUT /api/working-hours/toggle — toggle a day on/off for a teacher
export const toggleDay = async (req: Request, res: Response): Promise<void> => {
    try {
        const { TeacherWorkingHours } = getModels();
        const { teacherId, dayOfWeek, enabled, startTime, endTime } = req.body;

        if (!teacherId || !dayOfWeek) {
            res.status(400).json({ error: 'teacherId and dayOfWeek are required' });
            return;
        }

        if (enabled) {
            // Upsert
            const [record, created] = await TeacherWorkingHours.findOrCreate({
                where: { teacherId, dayOfWeek },
                defaults: {
                    teacherId, dayOfWeek,
                    startTime: startTime || '07:00',
                    endTime: endTime || '15:00',
                },
            });
            if (!created && (startTime || endTime)) {
                await record.update({
                    ...(startTime && { startTime }),
                    ...(endTime && { endTime }),
                });
            }
            res.json({ message: 'Day enabled', workingHours: record });
        } else {
            // Delete
            const deleted = await TeacherWorkingHours.destroy({
                where: { teacherId, dayOfWeek },
            });
            res.json({ message: deleted ? 'Day disabled' : 'Day was already disabled' });
        }
    } catch (error) {
        console.error('Toggle day error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
