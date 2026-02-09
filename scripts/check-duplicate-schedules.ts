
import { Schedule, Class, Subject, Teacher } from '../backend/src/models';
import sequelize from '../backend/src/config/database';

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
            where: { isActive: true }
        });

        const map = new Map();
        const duplicates = [];

        for (const s of schedules) {
            // Key: ClassID-Day-StartTime
            const key = `${s.classId}-${s.dayOfWeek}-${s.startTime}`;
            if (map.has(key)) {
                duplicates.push({
                    original: map.get(key),
                    duplicate: s
                });
            } else {
                map.set(key, s);
            }
        }

        console.log(`Found ${duplicates.length} duplicate schedules (same Class, Day, StartTime).`);

        for (const d of duplicates) {
            console.log(`Duplicate: 
                Class: ${d.duplicate.class?.name}
                Day: ${d.duplicate.dayOfWeek}
                Time: ${d.duplicate.startTime} - ${d.duplicate.endTime}
                Teacher: ${d.duplicate.teacherId}
                Subject: ${d.duplicate.subject?.name}
                IDs: ${d.original.id} vs ${d.duplicate.id}
            `);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

checkDuplicates();
