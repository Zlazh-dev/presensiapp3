import sequelize from './src/config/database';
import { TeacherAttendance, StudentAttendance } from './src/models';

/**
 * Script to verify that rekap data has been deleted
 */

async function verifyDeletion() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('✓ Database connection established\n');

    // Check remaining records
    const teacherCount = await TeacherAttendance.count();
    const studentCount = await StudentAttendance.count();

    console.log('Verification Results:');
    console.log(`  - Teacher attendance records: ${teacherCount}`);
    console.log(`  - Student attendance records: ${studentCount}`);

    if (teacherCount === 0 && studentCount === 0) {
      console.log('\n✅ SUCCESS: All rekap data has been successfully deleted!');
      console.log('   Both attendance tables are now empty.');
    } else {
      console.log('\n⚠️  WARNING: Some records still remain in the database.');
    }

    await sequelize.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error verifying deletion:', error);
    await sequelize.close();
    process.exit(1);
  }
}

verifyDeletion();