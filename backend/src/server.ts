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


const autoSeedDevData = async () => {
    const isDev = (process.env.NODE_ENV || 'development') === 'development';
    if (!isDev) {
        console.log('⏭️  Skipping auto-seed (production mode)');
        return;
    }

    try {
        const { User, Teacher, Class, Student, Subject, Schedule, Session, TimeSlot, TeacherAttendance, StudentAttendance, Geofence } = require('./models');

        // Check for the actual admin user
        const adminExists = await User.findOne({ where: { username: 'admin' } });
        const guru1Exists = await User.findOne({ where: { username: 'guru1' } });

        if (adminExists && guru1Exists) {
            // Even if users exist, check if classes/students need seeding
            const classCount = await Class.count();
            const studentCount = await Student.count();
            const timeSlotCount = await TimeSlot.count();
            const scheduleCount = await Schedule.count();
            if (classCount >= 4 && studentCount >= 50 && timeSlotCount >= 6 && scheduleCount >= 72) {
                console.log(`✓ Seed data found (${classCount} classes, ${studentCount} students, ${scheduleCount} schedules), skipping auto-seed`);
                return;
            }
        }

        console.log('⏳ Seeding dev test data...');

        // 0. Seed TimeSlots
        const defaultTimeSlots = [
            { slotNumber: 1, startTime: '07:00', endTime: '08:00' },
            { slotNumber: 2, startTime: '08:00', endTime: '09:00' },
            { slotNumber: 3, startTime: '09:00', endTime: '10:00' },
            { slotNumber: 4, startTime: '10:00', endTime: '11:00' },
            { slotNumber: 5, startTime: '11:00', endTime: '12:00' },
            { slotNumber: 6, startTime: '12:00', endTime: '13:00' },
        ];
        for (const slot of defaultTimeSlots) {
            await TimeSlot.findOrCreate({ where: { slotNumber: slot.slotNumber }, defaults: slot });
        }
        console.log('  ✓ 6 time slots seeded');

        // 1. Admin
        const adminPw = await bcrypt.hash('admin123', 10);
        const [adminUser] = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: {
                username: 'admin', password: adminPw, role: 'admin',
                name: 'Administrator', email: 'admin@example.com', isActive: true,
            },
        });

        // 2. Teacher users + records (multiple teachers for mock)
        const teacherPw = await bcrypt.hash('guru123', 10);
        const teacherConfigs = [
            { username: 'guru1', name: 'Guru Pertama', email: 'guru1@example.com', empId: 'EMP001', phone: '08123456789' },
            { username: 'guru2', name: 'Siti Nurhaliza', email: 'guru2@example.com', empId: 'EMP002', phone: '08123456790' },
            { username: 'guru3', name: 'Ahmad Rahman', email: 'guru3@example.com', empId: 'EMP003', phone: '08123456791' },
            { username: 'guru4', name: 'Dewi Kusuma', email: 'guru4@example.com', empId: 'EMP004', phone: '08123456792' },
            { username: 'guru5', name: 'Rudi Hermawan', email: 'guru5@example.com', empId: 'EMP005', phone: '08123456793' },
            { username: 'guru6', name: 'Budi Santoso', email: 'guru6@example.com', empId: 'EMP006', phone: '08123456794' },
            { username: 'guru7', name: 'Maya Sari', email: 'guru7@example.com', empId: 'EMP007', phone: '08123456795' },
        ];

        let teacher: any; // reference to first teacher for homeroom
        for (const tc of teacherConfigs) {
            const [tUser] = await User.findOrCreate({
                where: { username: tc.username },
                defaults: {
                    username: tc.username, password: teacherPw, role: 'teacher',
                    name: tc.name, email: tc.email, isActive: true,
                },
            });
            const [tRecord] = await Teacher.findOrCreate({
                where: { userId: tUser.id },
                defaults: { userId: tUser.id, employeeId: tc.empId, phone: tc.phone },
            });
            if (tc.username === 'guru1') teacher = tRecord;
        }
        console.log('  ✓ 7 teacher records seeded');

        // 3. Subjects (SMP mapel)
        const subjectConfigs = [
            { code: 'MATH', name: 'Matematika', description: 'Matematika SMP' },
            { code: 'BIND', name: 'Bahasa Indonesia', description: 'Bahasa Indonesia SMP' },
            { code: 'IPA', name: 'IPA', description: 'Ilmu Pengetahuan Alam' },
            { code: 'IPS', name: 'IPS', description: 'Ilmu Pengetahuan Sosial' },
            { code: 'BING', name: 'Bahasa Inggris', description: 'Bahasa Inggris SMP' },
            { code: 'PKN', name: 'PKN', description: 'Pendidikan Kewarganegaraan' },
            { code: 'SENI', name: 'Seni Budaya', description: 'Seni dan Budaya' },
            { code: 'PJOK', name: 'Penjaskes', description: 'Pendidikan Jasmani, Olahraga dan Kesehatan' },
        ];
        for (const sc of subjectConfigs) {
            await Subject.findOrCreate({ where: { code: sc.code }, defaults: sc });
        }
        const [subject] = await Subject.findOrCreate({ where: { code: 'MATH' }, defaults: { code: 'MATH', name: 'Matematika' } });
        console.log('  ✓ 8 subjects seeded');

        // 4. Four classes
        const classConfigs = [
            { name: '7A', level: 7 },
            { name: '7B', level: 7 },
            { name: '8A', level: 8 },
            { name: '8B', level: 8 },
        ];

        const studentNames = [
            'Ahmad Prasetyo', 'Budi Santoso', 'Citra Dewi', 'Dewi Rahayu', 'Eka Saputra',
            'Faisal Hidayat', 'Gita Sari', 'Hadi Wibowo', 'Indah Lestari', 'Joko Nugraha',
            'Kartika Permata', 'Lukman Utami', 'Maya Kurniawan', 'Nanda Sulistyo', 'Oki Anggraini',
            'Putri Firmansyah', 'Qori Wahyuni', 'Rina Setiawan', 'Sari Handayani', 'Taufik Purnomo',
            'Udin Rahman', 'Vina Kusuma', 'Wawan Hermawan', 'Xena Putri', 'Yoga Santoso',
            'Zahra Amini', 'Arif Budiman', 'Bella Safitri', 'Cahya Pratama', 'Dina Marlina',
            'Erwin Gunawan', 'Fitri Ayu', 'Gilang Ramadhan', 'Hana Melati', 'Imam Firmansyah',
            'Jasmine Oktavia', 'Kelvin Putra', 'Lina Mulyani', 'Maulana Rizky', 'Nadya Puspita',
            'Oscar Tri', 'Pipit Lestari', 'Rangga Aditya', 'Sinta Wahyu', 'Teguh Setiawan',
            'Ulfa Ramadhani', 'Vino Ardiansyah', 'Wulan Dari', 'Yusuf Alfarizi', 'Zain Maulana',
            'Annisa Fadilah', 'Bagas Septian', 'Cantika Wulandari', 'Dimas Aji', 'Elsa Novita',
            'Farhan Akbar', 'Gina Permata', 'Hafiz Maulana', 'Intan Olivia', 'Jihan Salsabila',
        ];

        let studentIndex = 0;
        for (const cc of classConfigs) {
            const [cls] = await Class.findOrCreate({
                where: { name: cc.name },
                defaults: { name: cc.name, level: cc.level, academicYear: '2025/2026', homeroomTeacherId: teacher.id },
            });

            // Seed 15 students per class
            for (let i = 0; i < 15; i++) {
                const nis = `2025${String(studentIndex + 1).padStart(4, '0')}`;
                const name = studentNames[studentIndex % studentNames.length];
                const gender = studentIndex % 2 === 0 ? 'M' : 'F';

                await Student.findOrCreate({
                    where: { nis },
                    defaults: { nis, name, classId: cls.id, gender },
                });
                studentIndex++;
            }
        }

        // 5. Weekly Schedules — Mon-Sat × 4 classes × 3 slots = 72 records
        const allTeachers = await Teacher.findAll({ order: [['id', 'ASC']] });
        const allSubjects = await Subject.findAll({ order: [['id', 'ASC']] });
        const allClasses = await Class.findAll({ order: [['id', 'ASC']] });

        // Subject codes for rotation: MATH, IPA, IPS, BIND, BING, PJOK
        const subjectRotation = ['MATH', 'IPA', 'IPS', 'BIND', 'BING', 'PJOK'];
        const subjectMap = new Map(allSubjects.map((s: any) => [s.code, s]));

        // Time slots for 3 periods per class per day
        const slots = [
            { start: '07:00:00', end: '08:00:00' },
            { start: '08:00:00', end: '09:00:00' },
            { start: '09:00:00', end: '10:00:00' },
        ];

        let scheduleCount = 0;

        // Senin(1) - Sabtu(6), 4 classes, 3 slots each
        for (let day = 1; day <= 6; day++) {
            for (let ci = 0; ci < allClasses.length && ci < 4; ci++) {
                const cls = allClasses[ci] as any;
                for (let si = 0; si < 3; si++) {
                    // Rotate teachers: (day + ci + si) mod 7
                    const teacherIdx = (day + ci + si) % Math.min(allTeachers.length, 7);
                    // Rotate subjects: (day + ci * 2 + si) mod 6
                    const subCode = subjectRotation[(day + ci * 2 + si) % subjectRotation.length];
                    const subj = subjectMap.get(subCode);
                    if (!allTeachers[teacherIdx] || !subj) continue;

                    await Schedule.findOrCreate({
                        where: {
                            teacherId: (allTeachers[teacherIdx] as any).id,
                            classId: cls.id,
                            dayOfWeek: day,
                            startTime: slots[si].start,
                        },
                        defaults: {
                            teacherId: (allTeachers[teacherIdx] as any).id,
                            classId: cls.id,
                            subjectId: (subj as any).id,
                            dayOfWeek: day,
                            startTime: slots[si].start,
                            endTime: slots[si].end,
                            academicYear: '2025/2026',
                            isActive: true,
                        },
                    });
                    scheduleCount++;
                }
            }
        }
        console.log(`  ✓ ${scheduleCount} jadwal mingguan seeded (Mon-Sat × 4 kelas × 3 jam)`);

        // 6. Active Sessions for today + tomorrow (for Guru Pengganti countdown)
        const jakartaOffset = 7 * 60; // UTC+7
        const nowMs = Date.now();
        const jakartaNow = new Date(nowMs + (jakartaOffset + new Date().getTimezoneOffset()) * 60000);
        const todayStr = jakartaNow.toISOString().split('T')[0];
        const todayDow = jakartaNow.getDay() || 7; // 1=Mon … 7=Sun

        const tomorrowDate = new Date(jakartaNow);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
        const tomorrowDow = tomorrowDate.getDay() || 7;

        let sessionCount = 0;
        for (const [dateStr, dow] of [[todayStr, todayDow], [tomorrowStr, tomorrowDow]] as [string, number][]) {
            const daySchedules = await Schedule.findAll({ where: { dayOfWeek: dow, isActive: true } });
            for (const sched of daySchedules as any[]) {
                const [, created] = await Session.findOrCreate({
                    where: { scheduleId: sched.id, date: dateStr },
                    defaults: {
                        scheduleId: sched.id,
                        date: dateStr,
                        startTime: sched.startTime,
                        status: 'scheduled',
                    },
                });
                if (created) sessionCount++;
            }
        }
        console.log(`  ✓ ${sessionCount} sesi aktif seeded (hari ini + besok)`);

        console.log('✅ Auto-seed complete!');
        console.log('   🔐 Admin:   admin / admin123');
        console.log('   🔐 Teacher: guru1 / guru123');
        console.log(`   📚 Classes: 7A, 7B, 8A, 8B (15 students each = ${studentIndex} total)`);

        // 7. Holidays
        const HolidayEvent = (await import('./models/HolidayEvent')).default;
        const holidayDefaults = [
            { date: '2026-02-12', reason: 'Maulid Nabi Muhammad SAW', type: 'national' as const },
            { date: '2026-03-28', reason: 'Hari Raya Nyepi', type: 'national' as const },
            { date: '2026-02-15', reason: 'Rapat Guru Semester', type: 'meeting' as const },
        ];
        for (const hd of holidayDefaults) {
            await HolidayEvent.findOrCreate({
                where: { date: hd.date, reason: hd.reason },
                defaults: { ...hd, isActive: true },
            });
        }
        console.log('  ✓ 3 holidays seeded');

        // 8b. Working Hours seed — all gurus Mon-Sat 07:00-15:00
        const TeacherWorkingHours = (await import('./models/TeacherWorkingHours')).default;
        let whCount = 0;
        for (const t of allTeachers as any[]) {
            for (let day = 1; day <= 6; day++) { // Senin-Sabtu
                const [, created] = await TeacherWorkingHours.findOrCreate({
                    where: { teacherId: t.id, dayOfWeek: day },
                    defaults: { teacherId: t.id, dayOfWeek: day, startTime: '07:00', endTime: '15:00', toleranceBeforeMin: 30, lateAfterMin: 5 },
                });
                if (created) whCount++;
            }
        }
        console.log(`  ✓ ${whCount} working hours seeded (${allTeachers.length} guru × 6 hari)`);
        const attStatuses = ['present', 'present', 'present', 'present', 'late', 'present', 'absent', 'present', 'sick', 'present'] as const;
        const allSessions = await Session.findAll({
            include: [{ model: Schedule, as: 'schedule', attributes: ['teacherId', 'classId'] }],
        });
        const allStudents = await Student.findAll({ attributes: ['id', 'classId'] });

        let taCount = 0;
        let saCount = 0;
        for (const sess of allSessions as any[]) {
            const teacherId = sess.schedule?.teacherId;
            if (teacherId) {
                const statusIdx = (sess.id + teacherId) % attStatuses.length;
                const status = attStatuses[statusIdx];
                const checkIn = status === 'absent' ? null : `07:${30 + (teacherId % 25)}:00`;
                const checkOut = status === 'absent' ? null : '16:00:00';
                const [, created] = await TeacherAttendance.findOrCreate({
                    where: { teacherId, date: sess.date },
                    defaults: {
                        teacherId, sessionId: sess.id, date: sess.date,
                        status, checkInTime: checkIn, checkOutTime: checkOut,
                    },
                });
                if (created) taCount++;
            }

            // Student attendance for class sessions
            const classId = sess.schedule?.classId;
            if (classId) {
                const classStudents = allStudents.filter((s: any) => s.classId === classId);
                for (const stu of classStudents) {
                    const sIdx = (sess.id + stu.id) % attStatuses.length;
                    const [, created] = await StudentAttendance.findOrCreate({
                        where: { studentId: stu.id, sessionId: sess.id },
                        defaults: {
                            studentId: stu.id, sessionId: sess.id,
                            status: attStatuses[sIdx],
                        },
                    });
                    if (created) saCount++;
                }
            }
        }
        console.log(`  ✓ ${taCount} teacher attendance + ${saCount} student attendance seeded (rekap)`);

        // Seed Geofence — Malang SMAN3
        const [gf, gfCreated] = await Geofence.findOrCreate({
            where: { isActive: true },
            defaults: {
                label: 'SMAN 3 Malang',
                latitude: -7.936,
                longitude: 112.629,
                radiusMeters: 100,
                isActive: true,
            } as any,
        });
        if (gfCreated) console.log('  ✓ Geofence seeded (SMAN 3 Malang, 100m)');
        else console.log('  ✓ Geofence already exists');
    } catch (error) {
        console.error('⚠️  Auto-seed failed (non-fatal):', error);
    }
};

// NOTE: needsSchemaReset function removed - we no longer do automatic schema resets
// to preserve data persistence. If you need to reset the schema, do it manually via SQL.

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

        // 3. Auto-seed ONLY if explicitly enabled via environment variable
        // To seed: set AUTO_SEED=true in .env or run with AUTO_SEED=true npm run dev
        if (process.env.AUTO_SEED === 'true') {
            console.log('🌱 AUTO_SEED=true detected, running seed...');
            await autoSeedDevData();
        } else {
            console.log('📦 Auto-seed disabled (set AUTO_SEED=true to enable)');
        }

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
