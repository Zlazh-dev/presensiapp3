import { io } from 'socket.io-client';
import axios from 'axios';

const SOCKET_URL = 'http://localhost:5000';
const API_URL = 'http://localhost:5000/api';

// Admin credentials
const ADMIN_USER = { username: 'admin', password: 'admin123' };

// Test Schedule Data
const TEST_SCHEDULE = {
    classId: 1,
    subjectId: 1,
    teacherId: 1,
    dayOfWeek: 2, // Tuesday
    startTime: '10:00',
    endTime: '11:30',
    academicYear: '2026/2027'
};

const verifyRealTime = async () => {
    console.log('🔄 Connecting to Socket.IO server...');
    const socket = io(SOCKET_URL);

    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('❌ Timeout waiting for socket event'));
            socket.disconnect();
        }, 10000);

        socket.on('connect', async () => {
            console.log('✅ Connected to Socket.IO');

            try {
                // 1. Login to get token
                console.log('🔄 Logging in as admin...');
                const loginRes = await axios.post(`${API_URL}/auth/login`, ADMIN_USER);
                const token = loginRes.data.token;
                console.log('✅ Logged in');

                // 2. Create Schedule via API
                console.log('🔄 Creating new schedule via API...');
                await axios.post(`${API_URL}/schedules`, TEST_SCHEDULE, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log('✅ Schedule creation request sent');

            } catch (error: any) {
                console.error('❌ API Error:', error.response?.data || error.message);
                clearTimeout(timeout);
                socket.disconnect();
                reject(error);
            }
        });

        // 3. Listen for event
        socket.on('schedule:created', (data) => {
            console.log('🎉 RECEIVED EVENT: schedule:created');
            console.log('📦 Data:', JSON.stringify(data, null, 2));

            if (data.dayOfWeek === TEST_SCHEDULE.dayOfWeek &&
                data.startTime.startsWith(TEST_SCHEDULE.startTime)) {
                console.log('✅ Content matches test data');
                clearTimeout(timeout);
                socket.disconnect();
                resolve();
            } else {
                console.warn('⚠️ Received event but data mismatch (might be from other tests)');
            }
        });

        socket.on('connect_error', (err) => {
            console.error('❌ Socket Connection Error:', err.message);
            clearTimeout(timeout);
            reject(err);
        });
    });
};

verifyRealTime()
    .then(() => {
        console.log('✨ SUCCESS: Real-time update verified!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('💀 FAILED:', err.message);
        process.exit(1);
    });
