
import sequelize from '../src/config/database';

const fixConstraints = async () => {
    console.log('🔧 Starting constraint fix...');
    const qi = sequelize.getQueryInterface();
    const transaction = await sequelize.transaction();

    try {
        const tableName = 'teacher_attendance';
        const constraintName = 'teacher_attendance_sessionId_fkey'; // Default Sequelize naming

        // 1. Check if constraint exists (or just try to drop it safely)
        console.log(`Checking/Dropping constraint: ${constraintName} on ${tableName}`);

        try {
            await qi.removeConstraint(tableName, constraintName, { transaction });
            console.log('✅ Old constraint removed.');
        } catch (error: any) {
            console.warn('⚠️ Could not remove constraint (maybe name mismatch or not exists):', error.message);
            // Fallback: Try to find actual name? 
            // Postgres: SELECT conname FROM pg_constraint WHERE conrelid = 'teacher_attendance'::regclass AND confrelid = 'sessions'::regclass;
            // For now, let's assume default naming or try to add anyway.
        }

        // 2. Add Constraint with CASCADE
        console.log('Adding new constraint with CASCADE...');
        await qi.addConstraint(tableName, {
            fields: ['sessionId'],
            type: 'foreign key',
            name: constraintName,
            references: {
                table: 'sessions',
                field: 'id',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            transaction,
        });

        console.log('✅ New constraint added successfully for teacher_attendance.');

        // ==========================================
        // Fix for student_attendance
        // ==========================================
        const saTable = 'student_attendance';
        const saConstraint = 'student_attendance_sessionId_fkey';

        console.log(`Checking/Dropping constraint: ${saConstraint} on ${saTable}`);
        try {
            await qi.removeConstraint(saTable, saConstraint, { transaction });
            console.log('✅ Old constraint removed (student_attendance).');
        } catch (error: any) {
            console.warn('⚠️ Could not remove constraint (maybe name mismatch or not exists):', error.message);
        }

        console.log('Adding new constraint with CASCADE (student_attendance)...');
        await qi.addConstraint(saTable, {
            fields: ['sessionId'],
            type: 'foreign key',
            name: saConstraint,
            references: {
                table: 'sessions',
                field: 'id',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            transaction,
        });
        console.log('✅ New constraint added successfully for student_attendance.');

        await transaction.commit();

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('❌ Failed to fix constraints:', error);
    }
};

fixConstraints();
