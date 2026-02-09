import sequelize from './src/config/database';
import {
    User,
    Teacher,
    Class,
    Student,
    Subject,
    Schedule,
    Session,
    TeacherAttendance,
    StudentAttendance,
} from './src/models';
import bcrypt from 'bcrypt';

const seedDatabase = async () => {
    try {
        console.log('🌱 Starting enhanced database seeding...');

        // Drop and recreate tables
        await sequelize.sync({ force: true });
        console.log('✓ Database synced');

        // 1. Create Users
        const adminPassword = await bcrypt.hash('admin123', 10);
        const admin = await User.create({
            username: 'admin',
            password: adminPassword,
            name: 'Administrator',
            email: 'admin@presensi.school',
            role: 'admin',
        });
        console.log('✓ Admin user created (username: admin, password: admin123)');

        // Create teacher users
        const teacherData = [
            {
                username: 'budi',
                password: 'budi123',
                name: 'Budi Santoso',
                email: 'budi@presensi.school',
                employeeId: 'T001',
                phone: '081234567890',
            },
            {
                username: 'siti',
                password: 'siti123',
                name: 'Siti Aminah',
                email: 'siti@presensi.school',
                employeeId: 'T002',
                phone: '081234567891',
            },
            {
                username: 'rudi',
                password: 'rudi123',
                name: 'Rudi Hermawan',
                email: 'rudi@presensi.school',
                employeeId: 'T003',
                phone: '081234567892',
            },
        ];

        const teachers = [];
        for (const teacher of teacherData) {
            const hashedPassword = await bcrypt.hash(teacher.password, 10);
            const user = await User.create({
                username: teacher.username,
                password: hashedPassword,
                name: teacher.name,
                email: teacher.email,
                role: 'teacher',
            });

            const teacherRecord = await Teacher.create({
                userId: user.id,
                employeeId: teacher.employeeId,
                phone: teacher.phone,
            });

            teachers.push(teacherRecord);
            console.log(
                `✓ Teacher created: ${teacher.name} (username: ${teacher.username}, password: ${teacher.password})`
            );
        }

        // 2. Create Subjects
        const subjects = await Subject.bulkCreate([
            { code: 'MTK', name: 'Matematika', description: 'Mata pelajaran Matematika' },
            { code: 'IND', name: 'Bahasa Indonesia', description: 'Mata pelajaran Bahasa Indonesia' },
            { code: 'IPA', name: 'IPA Terpadu', description: 'Mata pelajaran Ilmu Pengetahuan Alam' },
            { code: 'IPS', name: 'IPS Terpadu', description: 'Mata pelajaran Ilmu Pengetahuan Sosial' },
            { code: 'ENG', name: 'Bahasa Inggris', description: 'Mata pelajaran Bahasa Inggris' },
            { code: 'PJOK', name: 'Pendidikan Jasmani', description: 'Mata pelajaran Pendidikan Jasmani' },
        ]);
        console.log(`✓ Created ${subjects.length} subjects`);

        // 3. Create Classes
        const academicYear = '2025/2026';
        const classData = [
            { name: '7A', level: 7, homeroomTeacherId: teachers[0].id },
            { name: '7B', level: 7, homeroomTeacherId: teachers[1].id },
            { name: '8A', level: 8, homeroomTeacherId: teachers[2].id },
        ];

        const classes = [];
        for (const cls of classData) {
            const createdClass = await Class.create({
                ...cls,
                academicYear,
            });
            classes.push(createdClass);
            console.log(`✓ Class created: ${cls.name}`);
        }

        // 4. Create Students
        const studentNames = [
            { name: 'Ahmad Fauzi', gender: 'M', dob: '2010-05-15' },
            { name: 'Bayu Pratama', gender: 'M', dob: '2010-08-22' },
            { name: 'Citra Dewi', gender: 'F', dob: '2010-03-10' },
            { name: 'Doni Saputra', gender: 'M', dob: '2010-11-05' },
            { name: 'Eka Putri', gender: 'F', dob: '2010-07-18' },
            { name: 'Fajar Ramadhan', gender: 'M', dob: '2009-12-30' },
            { name: 'Gita Maharani', gender: 'F', dob: '2009-09-14' },
            { name: 'Hadi Wijaya', gender: 'M', dob: '2009-06-25' },
        ];

        let nisCounter = 1001;
        for (let i = 0; i < studentNames.length; i++) {
            const classIndex = i % classes.length;
            await Student.create({
                nis: String(nisCounter++),
                name: studentNames[i].name,
                classId: classes[classIndex].id,
                dateOfBirth: studentNames[i].dob,
                gender: studentNames[i].gender as 'M' | 'F',
            });
            console.log(
                `✓ Student created: ${studentNames[i].name} (Class: ${classes[classIndex].name})`
            );
        }

        // 5. Create Schedules
        const scheduleData = [
            // Monday
            { teacherId: teachers[0].id, classId: classes[0].id, subjectId: subjects[0].id, day: 1, start: '07:30', end: '09:00', room: 'R101' },
            { teacherId: teachers[1].id, classId: classes[1].id, subjectId: subjects[1].id, day: 1, start: '09:15', end: '10:45', room: 'R102' },
            // Tuesday
            { teacherId: teachers[2].id, classId: classes[2].id, subjectId: subjects[2].id, day: 2, start: '07:30', end: '09:00', room: 'R103' },
            { teacherId: teachers[0].id, classId: classes[1].id, subjectId: subjects[0].id, day: 2, start: '09:15', end: '10:45', room: 'R101' },
            // Wednesday
            { teacherId: teachers[1].id, classId: classes[0].id, subjectId: subjects[1].id, day: 3, start: '07:30', end: '09:00', room: 'R102' },
        ];

        const schedules = [];
        for (const sched of scheduleData) {
            const schedule = await Schedule.create({
                teacherId: sched.teacherId,
                classId: sched.classId,
                subjectId: sched.subjectId,
                dayOfWeek: sched.day,
                startTime: sched.start,
                endTime: sched.end,
                room: sched.room,
                academicYear,
            });
            schedules.push(schedule);
        }
        console.log(`✓ Created ${schedules.length} schedules`);

        // 6. Create Sessions (for current week)
        const today = new Date();
        const currentDay = today.getDay() || 7; // Convert Sunday (0) to 7

        for (const schedule of schedules) {
            if (schedule.dayOfWeek <= currentDay) {
                const daysAgo = currentDay - schedule.dayOfWeek;
                const sessionDate = new Date(today);
                sessionDate.setDate(today.getDate() - daysAgo);

                await Session.create({
                    scheduleId: schedule.id,
                    date: sessionDate.toISOString().split('T')[0],
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    status: 'completed',
                    topic: 'Sample lesson topic',
                });
            }
        }
        console.log('✓ Created sample sessions');

        // 7. Create sample Teacher Attendance
        const todayStr = today.toISOString().split('T')[0];
        for (const teacher of teachers) {
            await TeacherAttendance.create({
                teacherId: teacher.id,
                date: todayStr,
                checkInTime: '07:00:00',
                checkOutTime: '15:00:00',
                status: 'present',
                latitude: -6.2088,
                longitude: 106.8456,
            });
        }
        console.log('✓ Created teacher attendance records');

        console.log('\n✅ Enhanced database seeding completed successfully!');
        console.log('\n📝 Login Credentials:');
        console.log('Admin: username=admin, password=admin123');
        console.log('Teacher1: username=budi, password=budi123');
        console.log('Teacher2: username=siti, password=siti123');
        console.log('Teacher3: username=rudi, password=rudi123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedDatabase();
