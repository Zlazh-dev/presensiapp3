import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models';
import { generateToken } from '../utils/jwt';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password, role } = req.body;

        if (!username || !password || !role) {
            res.status(400).json({ error: 'Username, password, and role are required' });
            return;
        }

        // Check if user already exists
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            res.status(400).json({ error: 'Username already exists' });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            username,
            password: hashedPassword,
            role,
            name: username, // Use username as default name
        });

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { identifier, username, email, password } = req.body;

        // Accept identifier, username, or email — in that priority
        const loginIdentifier = identifier || username || email;

        console.log('[POST /api/auth/login] Attempt:', loginIdentifier);

        if (!loginIdentifier || !password) {
            res.status(400).json({ error: 'Username/email and password are required' });
            return;
        }

        // Look up by username OR email
        const { Op } = require('sequelize');
        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { username: loginIdentifier },
                    { email: loginIdentifier },
                ],
            },
        });

        if (!user) {
            console.log('[POST /api/auth/login] User not found:', loginIdentifier);
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Debug: log user info
        console.log('[POST /api/auth/login] User found:', {
            id: user.id,
            username: user.username,
            role: user.role,
            isActive: user.isActive,
            passwordHashLength: user.password?.length,
        });

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            console.log('[POST /api/auth/login] Invalid password for:', loginIdentifier);
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Check if user is active
        if (user.isActive === false) {
            console.log('[POST /api/auth/login] User is inactive:', loginIdentifier);
            res.status(403).json({ error: 'Akun Anda dinonaktifkan. Hubungi administrator.' });
            return;
        }

        const token = generateToken({
            id: user.id,
            username: user.username,
            role: user.role,
        });

        console.log('[POST /api/auth/login] Success for:', user.username);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: (user as any).name || user.username,
                email: (user as any).email,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const user = await User.findByPk(userId, {
            attributes: ['id', 'username', 'role', 'email', 'isActive'],
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({ user });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Seed test users and sample data for frontend testing
 * POST /api/auth/seed-test-users
 */
export const seedTestUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const { Teacher, Class, Session, Subject, Schedule } = require('../models');

        // Hash passwords
        const adminPassword = await bcrypt.hash('admin123', 10);
        const teacherPassword = await bcrypt.hash('guru123', 10);

        // 1. Create Admin User
        const [adminUser] = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: {
                username: 'admin',
                password: adminPassword,
                role: 'admin',
                name: 'Administrator',
                email: 'admin@example.com',
            },
        });

        // 2. Create Teacher User
        const [teacherUser] = await User.findOrCreate({
            where: { username: 'guru1' },
            defaults: {
                username: 'guru1',
                password: teacherPassword,
                role: 'teacher',
                name: 'Guru Pertama',
                email: 'guru1@example.com',
            },
        });

        // 3. Create Teacher Record
        const [teacher] = await Teacher.findOrCreate({
            where: { employeeId: 'EMP001' },
            defaults: {
                userId: teacherUser.id,
                employeeId: 'EMP001',
                phone: '08123456789',
            },
        });

        // 4. Create Sample Subject
        const [subject] = await Subject.findOrCreate({
            where: { code: 'MATH' },
            defaults: {
                code: 'MATH',
                name: 'Mathematics',
                description: 'Basic Mathematics',
            },
        });

        // 5. Create Sample Class
        const [sampleClass] = await Class.findOrCreate({
            where: { name: '7A' },
            defaults: {
                name: '7A',
                level: 7,
                academicYear: '2025/2026',
                homeroomTeacherId: teacher.id,
            },
        });

        // 6. Create Sample Schedule
        const today = new Date();
        const dayOfWeek = today.getDay() || 7; // Sunday = 7

        const [schedule] = await Schedule.findOrCreate({
            where: {
                teacherId: teacher.id,
                classId: sampleClass.id,
                subjectId: subject.id,
                dayOfWeek: dayOfWeek,
            },
            defaults: {
                teacherId: teacher.id,
                classId: sampleClass.id,
                subjectId: subject.id,
                dayOfWeek: dayOfWeek,
                startTime: '08:00:00',
                endTime: '09:30:00',
                room: 'Room 101',
                academicYear: '2025/2026',
                isActive: true,
            },
        });

        // 7. Create Active Session
        const todayStr = today.toISOString().split('T')[0];
        const [session] = await Session.findOrCreate({
            where: { scheduleId: schedule.id, date: todayStr },
            defaults: {
                scheduleId: schedule.id,
                date: todayStr,
                startTime: '08:00:00',
                endTime: '09:30:00',
                status: 'ongoing',
                topic: 'Introduction to Algebra',
            },
        });

        res.status(200).json({
            message: 'Test users and sample data created successfully',
            users: [
                {
                    username: 'admin',
                    password: 'admin123',
                    email: 'admin@example.com',
                    role: 'admin',
                },
                {
                    username: 'guru1',
                    password: 'guru123',
                    email: 'guru1@example.com',
                    role: 'teacher',
                    employeeId: 'EMP001',
                },
            ],
            sampleData: {
                class: { id: sampleClass.id, name: sampleClass.name },
                session: { id: session.id, status: session.status },
                subject: { code: subject.code, name: subject.name },
            },
            instructions: {
                login: 'POST /api/auth/login with username and password',
                scan: `Navigate to /scan?classId=${sampleClass.id}`,
            },
        });
    } catch (error) {
        console.error('Seed test users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * List seeded test users (debug endpoint)
 * GET /api/auth/test-users
 */
export const getTestUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'email', 'role', 'name', 'isActive'],
            order: [['id', 'ASC']],
        });

        res.json({
            count: users.length,
            users: users.map((u: any) => ({
                id: u.id,
                username: u.username,
                email: u.email,
                role: u.role,
                name: u.name,
                isActive: u.isActive,
            })),
            hint: 'Use POST /api/auth/login with {identifier, password} to login',
        });
    } catch (error) {
        console.error('Get test users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
