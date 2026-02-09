import bcrypt from 'bcrypt';
import sequelize from './config/database';
import { User, Teacher, Student, Class, Subject, Schedule, Session, TeacherAttendance, StudentAttendance } from './models';

async function seedDatabase() {
    try {
        console.log('🌱 Database Seeding Script');
        console.log('==========================\n');

        // Test connection
        await sequelize.authenticate();
        console.log('✓ Database connection established\n');

        // Clear existing data (optional - uncomment if needed)
        // await sequelize.sync({ force: true });

        console.log('⏳ Seeding data...\n');

        // 1. Create Admin User
        console.log('1️⃣ Creating admin user...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const adminUser = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: {
                username: 'admin',
                password: hashedPassword,
                name: 'Administrator',
                role: 'admin',
                email: 'admin@example.com',
                isActive: true
            }
        });
        console.log('   ✓ Admin user created (username: admin, password: admin123)\n');

        // 2. Create Teacher Users and Teachers
        console.log('2️⃣ Creating teachers...');
        const teacherData = [
            { username: 'teacher1', name: 'Budi Santoso, S.Pd', employeeId: 'T001', phone: '081234567890' },
            { username: 'teacher2', name: 'Siti Nurhaliza, S.Pd', employeeId: 'T002', phone: '081234567891' },
            { username: 'teacher3', name: 'Ahmad Rahman, M.Pd', employeeId: 'T003', phone: '081234567892' },
            { username: 'teacher4', name: 'Dewi Kusuma, S.Pd', employeeId: 'T004', phone: '081234567893' },
            { username: 'teacher5', name: 'Rudi Hermawan, S.Pd', employeeId: 'T005', phone: '081234567894' },
        ];

        const teachers = [];
        for (const data of teacherData) {
            const [user] = await User.findOrCreate({
                where: { username: data.username },
                defaults: {
                    username: data.username,
                    password: await bcrypt.hash('teacher123', 10),
                    name: data.name,
                    role: 'teacher',
                    email: `${data.username}@example.com`,
                    isActive: true
                }
            });

            const [teacher] = await Teacher.findOrCreate({
                where: { userId: user.id },
                defaults: {
                    userId: user.id,
                    employeeId: data.employeeId,
                    phone: data.phone
                }
            });

            teachers.push(teacher);
        }
        console.log(`   ✓ Created ${teachers.length} teachers\n`);

        // 3. Create Classes
        console.log('3️⃣ Creating classes...');
        const currentYear = new Date().getFullYear();
        const academicYear = `${currentYear}/${currentYear + 1}`;

        const classData = [
            { name: '7-A', level: 7, homeroomTeacherId: teachers[0].id },
            { name: '7-B', level: 7, homeroomTeacherId: teachers[1].id },
            { name: '8-A', level: 8, homeroomTeacherId: teachers[2].id },
            { name: '8-B', level: 8, homeroomTeacherId: teachers[3].id },
            { name: '9-A', level: 9, homeroomTeacherId: teachers[4].id },
        ];

        const classes = [];
        for (const data of classData) {
            const [classItem] = await Class.findOrCreate({
                where: { name: data.name, academicYear },
                defaults: {
                    ...data,
                    academicYear
                }
            });
            classes.push(classItem);
        }
        console.log(`   ✓ Created ${classes.length} classes\n`);

        // 4. Create Students
        console.log('4️⃣ Creating students...');
        const studentNames = [
            // Class 7-A (10 students)
            'Andi Wijaya', 'Rina Kartika', 'Budi Setiawan', 'Sari Dewi', 'Doni Pratama',
            'Lisa Anggraini', 'Riko Saputra', 'Maya Sari', 'Eko Yulianto', 'Tina Wulandari',
            // Class 7-B (10 students)
            'Farhan Ahmad', 'Cindy Permata', 'Hendra Gunawan', 'Indah Lestari', 'Joko Widodo',
            'Kartika Sari', 'Lukman Hakim', 'Mega Putri', 'Nanda Pratama', 'Olivia Tan',
            // Class 8-A (10 students)
            'Putra Mahendra', 'Qory Sandrina', 'Rizki Ramadan', 'Salsa Bella', 'Taufik Hidayat',
            'Umi Kalsum', 'Vino Bastian', 'Winda Sari', 'Xavier Nugraha', 'Yuni Shara',
            // Class 8-B (10 students)
            'Zainal Abidin', 'Alya Rohali', 'Bayu Skak', 'Citra Kirana', 'Dimas Anggara',
            'Elly Kasim', 'Firman Siagian', 'Gita Gutawa', 'Heri Cahyono', 'Ira Wibowo',
            // Class 9-A (10 students)
            'Jaya Suprana', 'Kiki Amalia', 'Lukman Sardi', 'Marsha Timothy', 'Nico Siahaan',
            'Okky Lukman', 'Pevita Pearce', 'Qubil Rajab', 'Raline Shah', 'Sherina Munaf',
        ];

        const students = [];
        let nisCounter = 2024001;
        for (let i = 0; i < studentNames.length; i++) {
            const classIndex = Math.floor(i / 10); // 10 students per class
            const nis = `NIS${nisCounter++}`;

            const [student] = await Student.findOrCreate({
                where: { nis },
                defaults: {
                    nis,
                    name: studentNames[i],
                    classId: classes[classIndex].id,
                    gender: i % 2 === 0 ? 'M' : 'F',
                    dateOfBirth: new Date(2010 + Math.floor(i / 10), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
                }
            });
            students.push(student);
        }
        console.log(`   ✓ Created ${students.length} students across ${classes.length} classes\n`);

        // 5. Create Subjects
        console.log('5️⃣ Creating subjects...');
        const subjectData = [
            { code: 'MTK', name: 'Matematika' },
            { code: 'IPA', name: 'Ilmu Pengetahuan Alam' },
            { code: 'IPS', name: 'Ilmu Pengetahuan Sosial' },
            { code: 'BHS', name: 'Bahasa Indonesia' },
            { code: 'ENG', name: 'Bahasa Inggris' },
            { code: 'AGM', name: 'Pendidikan Agama' },
            { code: 'PJK', name: 'Pendidikan Jasmani' },
        ];

        const subjects = [];
        for (const data of subjectData) {
            const [subject] = await Subject.findOrCreate({
                where: { code: data.code },
                defaults: data
            });
            subjects.push(subject);
        }
        console.log(`   ✓ Created ${subjects.length} subjects\n`);

        // 6. Create Teacher Attendance (last 7 days)
        console.log('6️⃣ Creating teacher attendance records...');
        let teacherAttendanceCount = 0;
        const today = new Date();

        for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
            const date = new Date(today);
            date.setDate(date.getDate() - dayOffset);
            const dateStr = date.toISOString().split('T')[0];

            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;

            for (const teacher of teachers) {
                const checkInHour = 7 + Math.floor(Math.random() * 2); // 7-8 AM
                const checkInMinute = Math.floor(Math.random() * 60);
                const checkOutHour = 14 + Math.floor(Math.random() * 3); // 2-4 PM
                const checkOutMinute = Math.floor(Math.random() * 60);

                const status = Math.random() > 0.1 ? 'present' : (Math.random() > 0.5 ? 'late' : 'sick');

                await TeacherAttendance.findOrCreate({
                    where: { teacherId: teacher.id, date: dateStr },
                    defaults: {
                        teacherId: teacher.id,
                        date: dateStr,
                        checkInTime: status === 'present' || status === 'late' ? `${String(checkInHour).padStart(2, '0')}:${String(checkInMinute).padStart(2, '0')}:00` : undefined,
                        checkOutTime: status === 'present' ? `${String(checkOutHour).padStart(2, '0')}:${String(checkOutMinute).padStart(2, '0')}:00` : undefined,
                        status,
                        latitude: -6.2088 + (Math.random() - 0.5) * 0.01,
                        longitude: 106.8456 + (Math.random() - 0.5) * 0.01,
                        notes: status === 'sick' ? 'Sakit flu' : (status === 'late' ? 'Terlambat karena macet' : undefined)
                    }
                });
                teacherAttendanceCount++;
            }
        }
        console.log(`   ✓ Created ${teacherAttendanceCount} teacher attendance records\n`);

        console.log('✅ Database seeding complete!\n');
        console.log('📊 Summary:');
        console.log(`   - Users: 1 admin + ${teachers.length} teachers = ${1 + teachers.length} total`);
        console.log(`   - Teachers: ${teachers.length}`);
        console.log(`   - Classes: ${classes.length}`);
        console.log(`   - Students: ${students.length}`);
        console.log(`   - Subjects: ${subjects.length}`);
        console.log(`   - Teacher Attendance: ${teacherAttendanceCount} records\n`);

        console.log('🔐 Login Credentials:');
        console.log('   Admin: username=admin, password=admin123');
        console.log('   Teachers: username=teacher1-5, password=teacher123\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Database seeding failed:');
        console.error(error);
        process.exit(1);
    }
}

seedDatabase();
