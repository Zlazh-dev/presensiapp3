import { Request, Response } from 'express';
import TimeSlot from '../models/TimeSlot';

export const getAllTimeSlots = async (req: Request, res: Response): Promise<void> => {
    try {
        const timeSlots = await TimeSlot.findAll({
            order: [['slotNumber', 'ASC']],
        });
        res.json({ timeSlots });
    } catch (error) {
        console.error('Get time slots error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createTimeSlot = async (req: Request, res: Response): Promise<void> => {
    try {
        const { slotNumber, startTime, endTime } = req.body;

        if (!slotNumber || !startTime || !endTime) {
            res.status(400).json({ error: 'slotNumber, startTime, and endTime are required' });
            return;
        }

        const existing = await TimeSlot.findOne({ where: { slotNumber } });
        if (existing) {
            res.status(409).json({ error: `Time slot ${slotNumber} already exists` });
            return;
        }

        const timeSlot = await TimeSlot.create({ slotNumber, startTime, endTime });
        res.status(201).json({ timeSlot });
    } catch (error) {
        console.error('Create time slot error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateTimeSlot = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { slotNumber, startTime, endTime } = req.body;

        const timeSlot = await TimeSlot.findByPk(Number(id));
        if (!timeSlot) {
            res.status(404).json({ error: 'Time slot not found' });
            return;
        }

        await timeSlot.update({ slotNumber, startTime, endTime });
        res.json({ timeSlot });
    } catch (error) {
        console.error('Update time slot error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteTimeSlot = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const timeSlot = await TimeSlot.findByPk(Number(id));

        if (!timeSlot) {
            res.status(404).json({ error: 'Time slot not found' });
            return;
        }

        await timeSlot.destroy();
        res.json({ message: 'Time slot deleted successfully' });
    } catch (error) {
        console.error('Delete time slot error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const seedTimeSlots = async (req: Request, res: Response): Promise<void> => {
    try {
        const defaultSlots = [
            { slotNumber: 1, startTime: '07:00', endTime: '08:00' },
            { slotNumber: 2, startTime: '08:00', endTime: '09:00' },
            { slotNumber: 3, startTime: '09:00', endTime: '10:00' },
            { slotNumber: 4, startTime: '10:00', endTime: '11:00' },
            { slotNumber: 5, startTime: '11:00', endTime: '12:00' },
            { slotNumber: 6, startTime: '12:00', endTime: '13:00' },
        ];

        const created: any[] = [];
        for (const slot of defaultSlots) {
            const [ts, wasCreated] = await TimeSlot.findOrCreate({
                where: { slotNumber: slot.slotNumber },
                defaults: slot,
            });
            if (wasCreated) created.push(ts);
        }

        res.json({
            message: `Seeded ${created.length} new time slots (${defaultSlots.length - created.length} already existed)`,
            timeSlots: await TimeSlot.findAll({ order: [['slotNumber', 'ASC']] }),
        });
    } catch (error) {
        console.error('Seed time slots error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
