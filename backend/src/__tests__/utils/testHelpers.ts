import request from 'supertest';
import express, { Express } from 'express';
import sequelize from '../../config/database';

/**
 * Setup test database and Express app
 */
export const setupTestApp = (): Express => {
    const app = express();
    app.use(express.json());
    return app;
};

/**
 * Setup test database
 */
export const setupTestDatabase = async () => {
    try {
        await sequelize.authenticate();
        // Drop all enum types to avoid conflicts on force sync
        try {
            await sequelize.query(`
                DO $$ DECLARE r RECORD;
                BEGIN
                    FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
                    LOOP
                        EXECUTE 'DROP TYPE IF EXISTS "public"."' || r.typname || '" CASCADE';
                    END LOOP;
                END $$;
            `);
        } catch { /* ignore if no enums */ }
        // force: true gives tests a clean slate every time
        await sequelize.sync({ force: true });
        console.log('✓ Test database initialized');
    } catch (error) {
        console.error('Test database setup failed:', error);
        throw error;
    }
};

/**
 * Clean all data from test database tables
 */
export const cleanDatabase = async () => {
    try {
        // Import models
        const { User, Teacher, Student, Class, TeacherAttendance, StudentAttendance, Session } = require('../../models');

        // Delete in correct order to respect foreign key constraints
        await TeacherAttendance.destroy({ where: {}, force: true });
        await StudentAttendance.destroy({ where: {}, force: true });
        await Teacher.destroy({ where: {}, force: true });
        await Student.destroy({ where: {}, force: true });
        await Session.destroy({ where: {}, force: true, cascade: true });
        await Class.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });
    } catch (error) {
        console.error('Database cleanup failed:', error);
        throw error;
    }
};

/**
 * Clean up test database
 */
export const teardownTestDatabase = async () => {
    try {
        await sequelize.close();
        console.log('✓ Test database connection closed');
    } catch (error) {
        console.error('Test database teardown failed:', error);
        throw error;
    }
};

/**
 * Create test user and get auth token
 */
export const getAuthToken = async (app: Express, username?: string, password: string = 'password123'): Promise<string> => {
    // Import dependencies needed for direct user creation
    const bcrypt = require('bcrypt');
    const { User } = require('../../models');
    const { generateToken } = require('../../utils/jwt');

    // Generate unique username if not provided to avoid conflicts
    const uniqueUsername = username || `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create user directly in database
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
        username: uniqueUsername,
        password: hashedPassword,
        role: 'admin',
        name: uniqueUsername,
    });

    // Generate token directly
    const token = generateToken({
        id: user.id,
        username: user.username,
        role: user.role,
    });

    return token;
};

/**
 * Mock geolocation coordinates
 */
export const mockCoordinates = {
    valid: {
        latitude: -6.2088, // Within radius
        longitude: 106.8456,
    },
    invalid: {
        latitude: -6.3000, // Outside radius
        longitude: 106.9000,
    },
};

/**
 * Test data factories
 */
export const testDataFactory = {
    user: (overrides = {}) => ({
        username: 'testuser',
        password: 'password123',
        role: 'admin',
        ...overrides,
    }),

    teacher: (overrides = {}) => ({
        employeeId: 'EMP001',
        phone: '08123456789',
        ...overrides,
    }),

    student: (overrides = {}) => ({
        name: 'Test Student',
        nis: '123456',
        classId: 1,
        dateOfBirth: '2010-01-01',
        gender: 'L',
        ...overrides,
    }),

    class: (overrides = {}) => ({
        name: '7A',
        level: 7,
        academicYear: '2023/2024',
        ...overrides,
    }),
};
