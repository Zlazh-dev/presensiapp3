import request from 'supertest';
import express from 'express';
import attendanceRoutes from '../../routes/attendanceRoutes';
import { setupTestDatabase, teardownTestDatabase, getAuthToken } from '../utils/testHelpers';
import { User, Teacher, Student, TeacherAttendance, Class } from '../../models';

const app = express();
app.use(express.json());
app.use('/api/attendance', attendanceRoutes);

describe('Attendance Endpoints', () => {
    let authToken: string;
    let testClass: any;

    beforeAll(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await teardownTestDatabase();
    });

    beforeEach(async () => {
        await TeacherAttendance.destroy({ where: {}, force: true });
        await Teacher.destroy({ where: {}, force: true });
        await Student.destroy({ where: {}, force: true });
        await Class.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });

        // Create a test class for students
        testClass = await Class.create({
            name: '7A',
            level: 7,
            academicYear: '2023/2024',
        });

        authToken = await getAuthToken(app);
    });

    describe('POST /api/attendance/scan', () => {
        it('should mark attendance successfully when within geofence', async () => {
            // Create a teacher
            const user = await User.create({
                username: 'teacher1',
                password: 'password',
                role: 'teacher',
                name: 'Test Teacher',
            });

            await Teacher.create({
                userId: user.id,
                employeeId: 'EMP123456',
            });

            const response = await request(app)
                .post('/api/attendance/scan')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    userId: user.id,
                    userType: 'teacher',
                    latitude: -6.2088, // Within default geofence
                    longitude: 106.8456,
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('attendance');
            expect(response.body.attendance).toHaveProperty('status', 'present');
        });

        it('should reject attendance when outside geofence', async () => {
            const user = await User.create({
                username: 'teacher1',
                password: 'password',
                role: 'teacher',
                name: 'Test Teacher',
            });

            await Teacher.create({
                userId: user.id,
                employeeId: 'EMP123456',
            });

            const response = await request(app)
                .post('/api/attendance/scan')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    userId: user.id,
                    userType: 'teacher',
                    latitude: -6.3000, // Outside geofence
                    longitude: 106.9000,
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Location outside geofence area');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/attendance/scan')
                .send({
                    userId: 1,
                    userType: 'teacher',
                    latitude: -6.2088,
                    longitude: 106.8456,
                });

            expect(response.status).toBe(401);
        });

        it('should require all fields', async () => {
            const response = await request(app)
                .post('/api/attendance/scan')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    userId: 1,
                    // Missing userType, latitude, longitude
                });

            expect(response.status).toBe(400);
        });

        it('should prevent duplicate attendance for same day', async () => {
            const user = await User.create({
                username: 'teacher2',
                password: 'password',
                role: 'teacher',
                name: 'Test Teacher 2',
            });

            await Teacher.create({
                userId: user.id,
                employeeId: 'EMP789',
            });

            // First scan
            await request(app)
                .post('/api/attendance/scan')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    userId: user.id,
                    userType: 'teacher',
                    latitude: -6.2088,
                    longitude: 106.8456,
                });

            // Second scan (should fail)
            const response = await request(app)
                .post('/api/attendance/scan')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    userId: user.id,
                    userType: 'teacher',
                    latitude: -6.2088,
                    longitude: 106.8456,
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/attendance?date=YYYY-MM-DD', () => {
        it('should get attendance records for a specific date', async () => {
            const user = await User.create({
                username: 'teacher1',
                password: 'password',
                role: 'teacher',
                name: 'Test Teacher',
            });

            const teacher = await Teacher.create({
                userId: user.id,
                employeeId: 'EMP123456',
            });

            const today = new Date().toISOString().split('T')[0];

            await TeacherAttendance.create({
                teacherId: teacher.id,
                status: 'present',
                date: today,
                checkInTime: '08:00:00',
                latitude: -6.2088,
                longitude: 106.8456,
            });

            const response = await request(app)
                .get(`/api/attendance?date=${today}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('attendance');
            expect(response.body.attendance).toHaveLength(1);
        });

        it('should require date parameter', async () => {
            const response = await request(app)
                .get('/api/attendance')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
        });
    });
});
