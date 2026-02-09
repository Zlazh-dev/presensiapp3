import sequelize from './config/database';
import './models'; // Import models to initialize associations

async function setupDatabase() {
    try {
        console.log('🔧 Database Setup Script');
        console.log('========================\n');

        // Test connection
        await sequelize.authenticate();
        console.log('✓ Database connection established\n');

        // Drop all tables
        console.log('⏳ Dropping all existing tables...');
        await sequelize.drop({ logging: console.log });
        console.log('✓ All tables dropped\n');

        // Create all tables
        console.log('⏳ Creating all tables from models...');
        await sequelize.sync({ force: false, logging: console.log });
        console.log('\n✓ All tables created successfully!\n');

        console.log('📊 Database schema created:');
        console.log('  - users');
        console.log('  - teachers');
        console.log('  - students');
        console.log('  - classes');
        console.log('  - subjects');
        console.log('  - schedules');
        console.log('  - sessions');
        console.log('  - teacher_attendance');
        console.log('  - student_attendance');
        console.log('  - activity_logs\n');

        console.log('✅ Database setup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database setup failed:');
        console.error(error);
        process.exit(1);
    }
}

setupDatabase();
