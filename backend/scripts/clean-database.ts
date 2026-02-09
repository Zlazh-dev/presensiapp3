import sequelize from '../src/config/database';
import {
    Session,
    TeacherAttendance,
    StudentAttendance,
    Schedule,
    ActivityLog,
    TimeSlot,
    HolidayEvent,
    TeacherWorkingHours,
} from '../src/models';

/**
 * Script to clean database data while preserving:
 * - Geofences (coordinates & radius)
 * - Students
 * - Users (and Teachers)
 * - Subjects
 * - Classes (needed for students reference)
 */
async function cleanDatabase() {
    console.log('🧹 Starting database cleanup...\n');
    console.log('✅ PRESERVED: users, teachers, students, subjects, geofences, classes\n');
    console.log('❌ CLEARING: sessions, attendances, schedules, activity_logs, time_slots, holidays, working_hours\n');

    try {
        await sequelize.authenticate();
        console.log('✓ Database connected\n');

        // Order matters due to foreign key constraints
        // Delete child tables first, then parent tables

        // 1. Clear Student Attendances
        const studentAttCount = await StudentAttendance.destroy({ where: {}, truncate: true, cascade: true });
        console.log(`✓ Cleared student_attendances`);

        // 2. Clear Teacher Attendances
        const teacherAttCount = await TeacherAttendance.destroy({ where: {}, truncate: true, cascade: true });
        console.log(`✓ Cleared teacher_attendances`);

        // 3. Clear Sessions
        const sessionCount = await Session.destroy({ where: {}, truncate: true, cascade: true });
        console.log(`✓ Cleared sessions`);

        // 4. Clear Schedules
        const scheduleCount = await Schedule.destroy({ where: {}, truncate: true, cascade: true });
        console.log(`✓ Cleared schedules`);

        // 5. Clear Activity Logs
        const activityCount = await ActivityLog.destroy({ where: {}, truncate: true, cascade: true });
        console.log(`✓ Cleared activity_logs`);

        // 6. Clear Time Slots
        const timeSlotCount = await TimeSlot.destroy({ where: {}, truncate: true, cascade: true });
        console.log(`✓ Cleared time_slots`);

        // 7. Clear Holiday Events
        const holidayCount = await HolidayEvent.destroy({ where: {}, truncate: true, cascade: true });
        console.log(`✓ Cleared holiday_events`);

        // 8. Clear Teacher Working Hours
        const workingHoursCount = await TeacherWorkingHours.destroy({ where: {}, truncate: true, cascade: true });
        console.log(`✓ Cleared teacher_working_hours`);

        console.log('\n✅ Database cleanup completed successfully!');
        console.log('\n📊 Data preserved:');
        console.log('   - Users & Teachers');
        console.log('   - Students');
        console.log('   - Subjects');
        console.log('   - Classes');
        console.log('   - Geofences (coordinates & radius)');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

// Run the script
cleanDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
