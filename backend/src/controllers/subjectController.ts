import { Request, Response } from 'express';
import { Subject } from '../models';

export const getAllSubjects = async (req: Request, res: Response): Promise<void> => {
    try {
        const subjects = await Subject.findAll({
            order: [['name', 'ASC']]
        });

        res.json({ subjects });
    } catch (error) {
        console.error('Get subjects error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createSubject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, name } = req.body;

        if (!code || !name) {
            res.status(400).json({ error: 'Code and name are required' });
            return;
        }

        const subject = await Subject.create({ code, name });
        res.status(201).json({ subject });
    } catch (error) {
        console.error('Create subject error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateSubject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { code, name } = req.body;

        const subject = await Subject.findByPk(Number(id));
        if (!subject) {
            res.status(404).json({ error: 'Subject not found' });
            return;
        }

        await subject.update({ code, name });
        res.json({ subject });
    } catch (error) {
        console.error('Update subject error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteSubject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const subject = await Subject.findByPk(Number(id));

        if (!subject) {
            res.status(404).json({ error: 'Subject not found' });
            return;
        }

        await subject.destroy();
        res.json({ message: 'Subject deleted successfully' });
    } catch (error) {
        console.error('Delete subject error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
