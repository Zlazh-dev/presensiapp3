/**
 * Migration Script: Fix Missing Teacher Records
 * 
 * This script creates Teacher records for any User with role='teacher'
 * that does not have a corresponding Teacher record.
 * 
 * Run with: npx tsx backend/src/scripts/fix-missing-teachers.ts
 */

import sequelize from '../config/database';
import User from '../models/User';
import Teacher from '../models/Teacher';

async function fixMissingTeachers() {
    console.log('🔍 Scanning for users without teacher records...\n');

    try {
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Find all teacher users
        const teacherUsers = await User.findAll({
            where: { role: 'teacher' },
            attributes: ['id', 'name', 'username'],
        });

        console.log(`📋 Found ${teacherUsers.length} users with role 'teacher'\n`);

        let created = 0;
        let skipped = 0;

        for (const user of teacherUsers) {
            // Check if Teacher record exists
            const existingTeacher = await Teacher.findOne({
                where: { userId: user.id },
            });

            if (existingTeacher) {
                console.log(`⏭️  SKIP: User "${user.name}" (ID: ${user.id}) already has Teacher record`);
                skipped++;
            } else {
                // Create missing Teacher record
                await Teacher.create({
                    userId: user.id,
                    employeeId: `EMP${user.id}`,
                    phone: null,
                });
                console.log(`✅ CREATED: Teacher record for "${user.name}" (User ID: ${user.id}, Employee ID: EMP${user.id})`);
                created++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`📊 SUMMARY:`);
        console.log(`   - Total teacher users: ${teacherUsers.length}`);
        console.log(`   - Created: ${created}`);
        console.log(`   - Skipped (already exists): ${skipped}`);
        console.log('='.repeat(50));

        if (created > 0) {
            console.log('\n✅ Migration complete! New teachers should now appear in Working Hours dropdown.');
        } else {
            console.log('\n✅ No action needed - all teacher users already have Teacher records.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

fixMissingTeachers();
