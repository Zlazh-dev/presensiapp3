import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/authRoutes';
import { setupTestDatabase, teardownTestDatabase } from '../utils/testHelpers';
import { User } from '../../models';
import bcrypt from 'bcrypt';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Endpoints', () => {
    beforeAll(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await teardownTestDatabase();
    });

    beforeEach(async () => {
        await User.destroy({ where: {}, force: true });
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'newuser',
                    password: 'password123',
                    role: 'admin',
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('message', 'User registered successfully');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('username', 'newuser');
            expect(response.body.user).not.toHaveProperty('password');
        });

        it('should not allow duplicate usernames', async () => {
            // Create first user
            await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    password: 'password123',
                    role: 'admin',
                });

            // Try to create duplicate
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    password: 'password456',
                    role: 'teacher',
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should require all fields', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    // Missing password and role
                });

            expect(response.status).toBe(400);
        });

        it('should hash the password', async () => {
            await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    password: 'password123',
                    role: 'admin',
                });

            const user = await User.findOne({ where: { username: 'testuser' } });
            expect(user).not.toBeNull();
            expect(user?.password).not.toBe('password123');

            const passwordValid = await bcrypt.compare('password123', user!.password);
            expect(passwordValid).toBe(true);
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Create a test user
            await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'loginuser',
                    password: 'password123',
                    role: 'admin',
                });
        });

        it('should login successfully with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'loginuser',
                    password: 'password123',
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('username', 'loginuser');
            expect(response.body.user).not.toHaveProperty('password');
        });

        it('should reject invalid username', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'wronguser',
                    password: 'password123',
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Invalid credentials');
        });

        it('should reject invalid password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'loginuser',
                    password: 'wrongpassword',
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Invalid credentials');
        });

        it('should require both username and password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'loginuser',
                    // Missing password
                });

            expect(response.status).toBe(400);
        });
    });
});
