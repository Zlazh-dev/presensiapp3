
import { User, Teacher, Class, Subject, Schedule, Session, TeacherAttendance } from '../src/models';
import sequelize from '../src/config/database';

const runTest = async () => {
    console.log('🔄 Starting Class Deletion Reproduction...');

    const randomSuffix = Math.floor(Math.random() * 10000);
    const username = `deltest_${randomSuffix}`;

    const transaction = await sequelize.transaction();
    let classId;

    try {
        // 1. Setup Data Hierarchy
        const user = await User.create({ name: 'DelTester', username, password: 'password', role: 'teacher' }, { transaction });
        const teacher = await Teacher.create({ userId: user.id, employeeId: `DEL_${randomSuffix}` }, { transaction });
        const cls = await Class.create({ name: `Delete Test Class ${randomSuffix}`, level: 7 as any }, { transaction });
        const subject = await Subject.create({ name: 'Delete Subject', code: `DS${randomSuffix}` }, { transaction });

        classId = cls.id;

        const sched = await Schedule.create({
            classId: cls.id, teacherId: teacher.id, subjectId: subject.id,
            dayOfWeek: 1, startTime: '08:00', endTime: '09:00', academicYear: '2025/2026', isActive: true
        }, { transaction });

        const session = await Session.create({
            scheduleId: sched.id, date: '2025-01-01', startTime: '08:00', status: 'completed'
        }, { transaction });

        // valid attendance linked to session
        await TeacherAttendance.create({
            teacherId: teacher.id, sessionId: session.id, date: '2025-01-01', status: 'present'
        }, { transaction });

        await transaction.commit();
        console.log('✅ Data Created. Class ID:', classId);

        // 2. Attempt Delete Class
        console.log('🗑️ Attempting to delete Class...');
        const classToDelete = await Class.findByPk(classId);
        if (classToDelete) {
            await classToDelete.destroy();
            console.log('🎉 Class Deleted Successfully (Unexpected if bug exists)');
        }

    } catch (error: any) {
        if (transaction) await transaction.rollback();
        console.error('❌ Delete Failed as Expected (or Unexpected Error):');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        if (error.original) {
            console.error('Original Error:', error.original.message);
        }
    } finally {
        // Cleanup if delete failed (or partially succeeded/failed in weird state)
        // If delete succeeded, data is gone. If failed, use force or individual deletes.
        try {
            if (classId) {
                const cls = await Class.findByPk(classId);
                if (cls) {
                    // Manual cleanup to not clutter DB
                    // Note: this might fail too if we don't fix the model, but it's just cleanup
                }
            }
        } catch (e) { console.error('Cleanup error', e); }
    }
};

runTest();
