
import { Schedule, Class, Subject, Teacher } from './src/models';
import sequelize from './src/config/database';
import dotenv from 'dotenv';
dotenv.config();

async function checkDuplicates() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const schedules = await Schedule.findAll({
            include: [
                { model: Class, as: 'class' },
                { model: Subject, as: 'subject' },
                { model: Teacher, as: 'teacher' }
            ],
            where: { isActive: true },
            order: [
                ['classId', 'ASC'],
                ['dayOfWeek', 'ASC'],
                ['startTime', 'ASC']
            ]
        });

        const grouped = new Map();

        for (const s of schedules) {
            // Key: ClassID-Day-SubjectID-TeacherID
            const key = `${s.classId}-${s.dayOfWeek}-${s.subjectId}-${s.teacherId}`;

            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(s);
        }

        let multiCount = 0;
        for (const [key, list] of grouped.entries()) {
            if (list.length > 1) {
                console.log(`\nFound ${list.length} schedules for same Class/Day/Subject/Teacher:`);
                const first = list[0];
                console.log(`  Class: ${first.class?.name}, Day: ${first.dayOfWeek}, Subject: ${first.subject?.name}, Teacher ID: ${first.teacherId}`);

                for (const s of list) {
                    console.log(`    - ID: ${s.id}, Time: ${s.startTime} - ${s.endTime}`);
                }
                multiCount++;
            }
        }

        console.log(`\nTotal groups with multiple schedules: ${multiCount}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

checkDuplicates();
