// Force Node.js to use Asia/Jakarta (WIB, UTC+7) for all Date operations
process.env.TZ = 'Asia/Jakarta';

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sequelize from './config/database';
import bcrypt from 'bcrypt';

// Import routes
import authRoutes from './routes/authRoutes';
import classRoutes from './routes/classRoutes';
import studentRoutes from './routes/studentRoutes';
import teacherRoutes from './routes/teacherRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import qrRoutes from './routes/qrRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import subjectRoutes from './routes/subjectRoutes';
import timeSlotRoutes from './routes/timeSlotRoutes';
import holidayRoutes from './routes/holidayRoutes';
import workingHoursRoutes from './routes/workingHoursRoutes';
import geofenceRoutes from './routes/geofenceRoutes';
import adminRoutes from './routes/adminRoutes';
import sessionRoutes from './routes/sessionRoutes';

// Import models to initialize associations
import './models';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
// app.use('/api/reports', reportRoutes); // Temporarily disabled
app.use('/api/qr', qrRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/time-slots', timeSlotRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/working-hours', workingHoursRoutes);
app.use('/api/geofence', geofenceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sessions', sessionRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Debug endpoint - DB status
app.get('/api/debug/db-status', async (req: Request, res: Response) => {
    try {
        await sequelize.authenticate();
        const { User } = require('./models');
        const userCount = await User.count();
        const sampleUsers = await User.findAll({
            attributes: ['id', 'username', 'email', 'role', 'name'],
            limit: 10,
            order: [['id', 'ASC']],
        });
        res.json({
            dbConnected: true,
            nodeEnv: process.env.NODE_ENV || 'development',
            userCount,
            sampleUsers: sampleUsers.map((u: any) => ({
                id: u.id, username: u.username, email: u.email, role: u.role, name: u.name,
            })),
        });
    } catch (error: any) {
        res.status(500).json({
            dbConnected: false,
            error: error.message,
        });
    }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Database connection and server start
import { createServer } from 'http';
import { initSocket } from './socket';

// Cron job for auto-fill alpha
import cron from 'node-cron';
import { autoFillAlpha } from './controllers/attendanceController';

// Schedule auto-fill alpha at 01:00 AM daily
// Schedule auto-fill alpha at 01:00 AM daily
cron.schedule('0 1 * * *', async () => {
    console.log('⏰ [CRON] Running auto-fill alpha job...');
    try {
        const result = await autoFillAlpha();
        console.log(`✅ [CRON] Auto-fill alpha completed: ${result.regularCreated} regular, ${result.sessionCreated} session records`);
    } catch (error) {
        console.error('❌ [CRON] Auto-fill alpha failed:', error);
    }
}, {
    timezone: 'Asia/Jakarta'
});

// Real-time Session Time Checker (Every minute)
import { checkSessionTimings } from './controllers/sessionTimeChecker';
cron.schedule('* * * * *', () => {
    // console.log('⏰ [CRON] Checking session timings...');
    checkSessionTimings();
});


// NOTE: Dev seed data removed — only admin user is seeded automatically.
// If you need test data, create it manually via the admin UI.




// Seed the default admin user on every startup (production & development)
const seedAdminUser = async () => {
    try {
        const { User } = require('./models');
        const adminPassword = await bcrypt.hash('14390626', 10);
        const [admin, created] = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: {
                username: 'admin',
                password: adminPassword,
                role: 'admin',
                name: 'Administrator',
                email: 'admin@presensiapp.local',
                isActive: true,
            },
        });
        if (created) {
            console.log('🔐 Admin user seeded (admin / 14390626)');
        } else {
            console.log('✓ Admin user exists');
        }
    } catch (error) {
        console.error('⚠️  Admin seed failed:', error);
    }
};

const startServer = async () => {
    try {
        // 1. Test database connection
        await sequelize.authenticate();
        console.log('✓ Database connection established');

        // 2. Sync database schema - only create tables if they don't exist
        // NOTE: alter: true removed due to Sequelize FK bug with ALTER TABLE
        const tables = await sequelize.getQueryInterface().showAllTables();
        if (tables.length === 0) {
            console.log('📦 First run - creating tables...');
            await sequelize.sync(); // Create all tables
        } else {
            console.log(`✓ ${tables.length} tables exist - schema ready`);
        }

        // 3. Always seed admin user (production & development)
        await seedAdminUser();




        const httpServer = createServer(app);
        initSocket(httpServer);
        console.log('✓ Socket.IO initialized');

        httpServer.listen(PORT, () => {
            console.log(`✓ Server running on port ${PORT}`);
            console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
