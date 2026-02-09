import sequelize from './src/config/database';
import { TeacherAttendance, StudentAttendance } from './src/models';

/**
 * Script to delete all attendance data (rekap data)
 * This deletes:
 * - All teacher attendance records
 * - All student attendance records
 */

async function deleteRekapData() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    console.log('\n⚠️  WARNING: This will delete ALL attendance data!');
    console.log('This includes:');
    console.log('  - Teacher attendance records (teacher_attendance table)');
    console.log('  - Student attendance records (student_attendance table)');

    // Count records before deletion
    const teacherCount = await TeacherAttendance.count();
    const studentCount = await StudentAttendance.count();
    console.log(`\nCurrent records:`);
    console.log(`  - Teacher attendance: ${teacherCount} records`);
    console.log(`  - Student attendance: ${studentCount} records`);

    console.log('\nDeleting records...');

    // Delete student attendance first (due to foreign key dependencies)
    const deletedStudents = await StudentAttendance.destroy({
      where: {}
    });
    console.log(`✓ Deleted ${deletedStudents} student attendance records`);

    // Delete teacher attendance
    const deletedTeachers = await TeacherAttendance.destroy({
      where: {}
    });
    console.log(`✓ Deleted ${deletedTeachers} teacher attendance records`);

    console.log('\n✅ Successfully deleted all rekap data!');
    console.log('\nSummary:');
    console.log(`  - Deleted ${deletedTeachers} teacher attendance records`);
    console.log(`  - Deleted ${deletedStudents} student attendance records`);

    await sequelize.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error deleting rekap data:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// Run the deletion
deleteRekapData();