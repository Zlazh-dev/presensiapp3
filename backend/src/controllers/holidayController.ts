import { Request, Response } from 'express';
import { Op } from 'sequelize';
import HolidayEvent from '../models/HolidayEvent';
import { Class } from '../models';

/**
 * GET /api/holidays
 * List all holidays (optionally filter by year/month)
 */
export const getAllHolidays = async (req: Request, res: Response): Promise<void> => {
    try {
        const { year, month } = req.query;
        const where: any = {};

        if (year) {
            const y = Number(year);
            const startDate = month
                ? `${y}-${String(month).padStart(2, '0')}-01`
                : `${y}-01-01`;
            const endDate = month
                ? `${y}-${String(Number(month) + 1).padStart(2, '0')}-01`
                : `${y + 1}-01-01`;
            where.date = { [Op.gte]: startDate, [Op.lt]: endDate };
        }

        const holidays = await HolidayEvent.findAll({
            where,
            include: [{ model: Class, as: 'class', attributes: ['id', 'name'], required: false }],
            order: [['date', 'ASC']],
        });

        res.json({ holidays, count: holidays.length });
    } catch (error) {
        console.error('Get holidays error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/holidays/active
 * Get today's active holidays (used by scan logic)
 */
export const getActiveHolidays = async (req: Request, res: Response): Promise<void> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { classId } = req.query;

        const where: any = {
            date: today,
            isActive: true,
        };

        // School-wide OR class-specific
        if (classId) {
            where[Op.or] = [
                { classId: null },
                { classId: Number(classId) },
            ];
        } else {
            where.classId = null;           // Only school-wide
        }

        const holidays = await HolidayEvent.findAll({
            where,
            include: [{ model: Class, as: 'class', attributes: ['id', 'name'], required: false }],
        });

        res.json({
            isHoliday: holidays.length > 0,
            holidays,
            date: today,
        });
    } catch (error) {
        console.error('Get active holidays error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/holidays
 */
export const createHoliday = async (req: Request, res: Response): Promise<void> => {
    try {
        const { date, reason, type, classId } = req.body;

        if (!date || !reason || !type) {
            res.status(400).json({ error: 'date, reason, dan type wajib diisi' });
            return;
        }

        if (!['national', 'school', 'meeting'].includes(type)) {
            res.status(400).json({ error: 'type harus: national, school, atau meeting' });
            return;
        }

        const holiday = await HolidayEvent.create({
            date,
            reason,
            type,
            classId: classId || null,
            isActive: true,
        });

        res.status(201).json({ holiday });
    } catch (error) {
        console.error('Create holiday error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * PUT /api/holidays/:id
 */
export const updateHoliday = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { date, reason, type, classId, isActive } = req.body;

        const holiday = await HolidayEvent.findByPk(Number(id));
        if (!holiday) {
            res.status(404).json({ error: 'Holiday not found' });
            return;
        }

        await holiday.update({
            ...(date !== undefined && { date }),
            ...(reason !== undefined && { reason }),
            ...(type !== undefined && { type }),
            ...(classId !== undefined && { classId: classId || null }),
            ...(isActive !== undefined && { isActive }),
        });

        res.json({ holiday });
    } catch (error) {
        console.error('Update holiday error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * DELETE /api/holidays/:id
 */
export const deleteHoliday = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const holiday = await HolidayEvent.findByPk(Number(id));

        if (!holiday) {
            res.status(404).json({ error: 'Holiday not found' });
            return;
        }

        await holiday.destroy();
        res.json({ message: 'Holiday deleted successfully' });
    } catch (error) {
        console.error('Delete holiday error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/holidays/import
 * Bulk import from JSON array (from Excel parse on frontend)
 * Expected body: { holidays: [{ date, reason, type, classId? }] }
 */
export const importHolidays = async (req: Request, res: Response): Promise<void> => {
    try {
        const { holidays } = req.body;

        if (!Array.isArray(holidays) || holidays.length === 0) {
            res.status(400).json({ error: 'holidays array is required' });
            return;
        }

        const validTypes = ['national', 'school', 'meeting'];
        const results = { created: 0, skipped: 0, errors: [] as string[] };

        for (let i = 0; i < holidays.length; i++) {
            const h = holidays[i];
            if (!h.date || !h.reason || !h.type) {
                results.errors.push(`Row ${i + 1}: date, reason, dan type wajib diisi`);
                results.skipped++;
                continue;
            }
            if (!validTypes.includes(h.type)) {
                results.errors.push(`Row ${i + 1}: type harus national/school/meeting`);
                results.skipped++;
                continue;
            }

            await HolidayEvent.findOrCreate({
                where: { date: h.date, reason: h.reason },
                defaults: {
                    date: h.date,
                    reason: h.reason,
                    type: h.type,
                    classId: h.classId || null,
                    isActive: true,
                },
            });
            results.created++;
        }

        res.json({
            message: `Import selesai: ${results.created} berhasil, ${results.skipped} dilewati`,
            ...results,
        });
    } catch (error) {
        console.error('Import holidays error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/holidays/seed
 * Seed default holidays
 */
export const seedHolidays = async (req: Request, res: Response): Promise<void> => {
    try {
        const defaults = [
            { date: '2026-02-12', reason: 'Maulid Nabi Muhammad SAW', type: 'national' as const },
            { date: '2026-03-28', reason: 'Hari Raya Nyepi', type: 'national' as const },
            { date: '2026-02-15', reason: 'Rapat Guru Semester', type: 'meeting' as const },
        ];

        const created: any[] = [];
        for (const d of defaults) {
            const [h, wasCreated] = await HolidayEvent.findOrCreate({
                where: { date: d.date, reason: d.reason },
                defaults: { ...d, isActive: true },
            });
            if (wasCreated) created.push(h);
        }

        res.json({
            message: `Seeded ${created.length} holidays (${defaults.length - created.length} already existed)`,
            holidays: await HolidayEvent.findAll({ order: [['date', 'ASC']] }),
        });
    } catch (error) {
        console.error('Seed holidays error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
