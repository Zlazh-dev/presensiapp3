
import { User, Teacher, Class, Subject, Schedule, Session, TeacherAttendance } from '../src/models';
import { checkInSession } from '../src/controllers/sessionController';
import sequelize from '../src/config/database';
import { Request, Response } from 'express';

// Mock Express Request/Response
const mockResponse = () => {
    const res: any = {
        statusCode: 200 // Default to 200
    };
    res.status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data: any) => {
        res.body = data;
        return res;
    };
    return res;
};

const runTest = async () => {
    console.log('🔄 Starting Auto-Merge Verification...');

    // 1. Setup Data
    const randomSuffix = Math.floor(Math.random() * 10000);
    const username = `mergetester_${randomSuffix}`;
    const employeeId = `MERGE_${randomSuffix}`;

    let createdIds: any = {};

    const transaction = await sequelize.transaction();
    try {
        // Create Mock Teacher
        const user = await User.create({ name: 'MergeTester', username, password: 'password', role: 'teacher' }, { transaction });
        const teacher = await Teacher.create({ userId: user.id, employeeId }, { transaction });
        createdIds.userId = user.id;
        createdIds.teacherId = teacher.id;

        // Create Mock Class & Subject
        const cls = await Class.create({ name: `Class Merge Test ${randomSuffix}`, level: 7 as any }, { transaction });
        const subject = await Subject.create({ name: 'Subject Merge', code: `SM${randomSuffix}` }, { transaction });
        createdIds.classId = cls.id;
        createdIds.subjectId = subject.id;

        // Determine today's day of week
        const now = new Date();
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
        const dateStr = now.toISOString().split('T')[0];
        createdIds.dateStr = dateStr;

        // Create 2 Consecutive Schedules
        // Schedule A: Now + 10 mins (to ensure it's valid for check-in)
        // Actually, check-in logic allows check-in if within specific window. 
        // Let's set Schedule A to start "Now" so it's definitely valid.
        const timeStr = now.toTimeString().substring(0, 5); // HH:MM

        // We need robust "EndTime" calculation
        const startA = new Date(now.getTime());
        const endA = new Date(now.getTime() + 40 * 60000);
        const endB = new Date(now.getTime() + 80 * 60000);

        const fmt = (d: Date) => d.toTimeString().substring(0, 5);

        console.log(`📅 Creating Schedules for Day ${dayOfWeek}:`);
        console.log(`   Sched 1: ${fmt(startA)} - ${fmt(endA)}`);
        console.log(`   Sched 2: ${fmt(endA)} - ${fmt(endB)}`);

        const sched1 = await Schedule.create({
            classId: cls.id, teacherId: teacher.id, subjectId: subject.id,
            dayOfWeek, startTime: fmt(startA), endTime: fmt(endA), academicYear: '2025/2026', isActive: true
        }, { transaction });

        const sched2 = await Schedule.create({
            classId: cls.id, teacherId: teacher.id, subjectId: subject.id,
            dayOfWeek, startTime: fmt(endA), endTime: fmt(endB), academicYear: '2025/2026', isActive: true
        }, { transaction });

        createdIds.sched1Id = sched1.id;
        createdIds.sched2Id = sched2.id;

        // Pre-requisite: Teacher must have Regular Attendance
        await TeacherAttendance.create({
            teacherId: teacher.id,
            date: dateStr,
            status: 'present',
            checkInTime: '07:00:00'
        }, { transaction });

        await transaction.commit();

        // 2. Simulate Check-In
        console.log('🚀 Simulating Check-In...');


        // Fetch Active Geofence
        const { Geofence } = require('../src/models');
        const geofence = await Geofence.findOne({ where: { isActive: true } });
        const lat = geofence ? Number(geofence.latitude) : -6.1;
        const lng = geofence ? Number(geofence.longitude) : 106.8;

        const req: any = {
            user: { id: user.id },
            body: {
                qrData: JSON.stringify({
                    type: 'class-session',
                    id: cls.id,
                    token: cls.qrCodeData || 'mock-token'
                }),
                lat, lng
            }
        };

        // Update Class with token so check passes
        await cls.update({ qrCodeData: 'valid-test-token' });
        req.body.qrData = JSON.stringify({ type: 'class-session', id: cls.id, token: 'valid-test-token' });

        const res = mockResponse();

        // Check In
        await checkInSession(req as Request, res as Response);

        console.log('📡 Response Status:', res.statusCode);
        console.log('📦 Response Body:', JSON.stringify(res.body, null, 2));

        if (res.statusCode === 200 && res.body?.session) {
            // 3. Verify Session
            const session = await Session.findByPk(res.body.session.id);
            if (session && session.endTime) {
                console.log('✅ Session Created:', session.id);
                console.log('   Expected EndTime:', fmt(endB));
                console.log('   Actual EndTime:  ', session.endTime.substring(0, 5));
                createdIds.sessionId = session.id;

                if (session.endTime.substring(0, 5) === fmt(endB)) {
                    console.log('🎉 SUCCESS: Session Automatically Merged!');
                } else {
                    console.error('❌ FAILURE: Session EndTime does not match merged time.');
                }
            }
        } else {
            console.error('❌ Check-In Failed');
        }


    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('❌ Test Error:', error);
    }
};

runTest();
