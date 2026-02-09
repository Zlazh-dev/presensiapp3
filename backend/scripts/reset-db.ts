import sequelize from '../src/config/database';
import { User, Geofence, TimeSlot } from '../src/models';
import bcrypt from 'bcrypt';

const resetDb = async () => {
    try {
        console.log('🔌 Connecting to database...');
        await sequelize.authenticate();

        console.log('🗑️  Clearing all data (Force Sync)...');
        // Force sync drops and recreates tables
        await sequelize.sync({ force: true });

        console.log('✨ Database cleared. Seeding minimal config...');

        // 1. Seed TimeSlots (Standard)
        const defaultTimeSlots = [
            { slotNumber: 1, startTime: '07:00', endTime: '08:00' },
            { slotNumber: 2, startTime: '08:00', endTime: '09:00' },
            { slotNumber: 3, startTime: '09:00', endTime: '10:00' },
            { slotNumber: 4, startTime: '10:00', endTime: '11:00' },
            { slotNumber: 5, startTime: '11:00', endTime: '12:00' },
            { slotNumber: 6, startTime: '12:00', endTime: '13:00' },
        ];
        await TimeSlot.bulkCreate(defaultTimeSlots);
        console.log('  ✓ TimeSlots seeded');

        // 2. Seed Admin
        const password = await bcrypt.hash('admin123', 10);
        await User.create({
            username: 'admin',
            password,
            role: 'admin',
            name: 'Administrator',
            email: 'admin@example.com',
            isActive: true
        });
        console.log('  ✓ Admin created (admin / admin123)');

        // 3. Seed Geofence
        await Geofence.create({
            label: 'SMAN 3 Malang (Default)',
            latitude: -7.936, // Using same value as server.ts
            longitude: 112.629,
            radiusMeters: 100,
            isActive: true
        });
        console.log('  ✓ Geofence seeded');

        console.log('✅ Database reset complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting DB:', error);
        process.exit(1);
    }
};

resetDb();
