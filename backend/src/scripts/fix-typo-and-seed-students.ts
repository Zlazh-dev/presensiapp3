/**
 * Fix Script: Subject Typo + Seed Realistic Students
 * Uses raw SQL to avoid model initialization issues
 * 
 * Run: npx tsx backend/src/scripts/fix-typo-and-seed-students.ts
 */

import sequelize from '../config/database';

const STUDENT_NAMES_7A = [
    { name: 'Ahmad Rizki', nis: '2025101', gender: 'M' },
    { name: 'Aisyah Putri', nis: '2025102', gender: 'F' },
    { name: 'Bayu Pratama', nis: '2025103', gender: 'M' },
    { name: 'Citra Dewi', nis: '2025104', gender: 'F' },
    { name: 'Dimas Arya', nis: '2025105', gender: 'M' },
    { name: 'Eka Safitri', nis: '2025106', gender: 'F' },
    { name: 'Farhan Maulana', nis: '2025107', gender: 'M' },
    { name: 'Galuh Anggraini', nis: '2025108', gender: 'F' },
    { name: 'Hasan Nugroho', nis: '2025109', gender: 'M' },
    { name: 'Indah Permata', nis: '2025110', gender: 'F' },
    { name: 'Joko Susanto', nis: '2025111', gender: 'M' },
    { name: 'Kartika Sari', nis: '2025112', gender: 'F' },
    { name: 'Lukman Hakim', nis: '2025113', gender: 'M' },
    { name: 'Maya Rahmawati', nis: '2025114', gender: 'F' },
    { name: 'Naufal Azzam', nis: '2025115', gender: 'M' },
];

const STUDENT_NAMES_7B = [
    { name: 'Olivia Rahma', nis: '2025201', gender: 'F' },
    { name: 'Putra Aditya', nis: '2025202', gender: 'M' },
    { name: 'Qonita Zahra', nis: '2025203', gender: 'F' },
    { name: 'Raka Firmansyah', nis: '2025204', gender: 'M' },
    { name: 'Siti Nurhaliza', nis: '2025205', gender: 'F' },
    { name: 'Taufik Hidayat', nis: '2025206', gender: 'M' },
    { name: 'Umi Kalsum', nis: '2025207', gender: 'F' },
    { name: 'Vino Bastian', nis: '2025208', gender: 'M' },
    { name: 'Wulan Dari', nis: '2025209', gender: 'F' },
    { name: 'Xavier Pranata', nis: '2025210', gender: 'M' },
    { name: 'Yuni Astuti', nis: '2025211', gender: 'F' },
    { name: 'Zaki Rahman', nis: '2025212', gender: 'M' },
    { name: 'Anisa Fitria', nis: '2025213', gender: 'F' },
    { name: 'Bima Sakti', nis: '2025214', gender: 'M' },
    { name: 'Cantika Maharani', nis: '2025215', gender: 'F' },
];

async function main() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // ── 1. Fix Subject Typo ──
        console.log('📝 Fixing subject typo...');
        const [, typoResult] = await sequelize.query(
            `UPDATE subjects SET name = 'Bahasa Indonesia' WHERE name = 'Bahasa Indonesai'`
        );
        console.log(`   ✅ Updated ${(typoResult as any)?.rowCount ?? 'unknown'} record(s)\n`);

        // ── 2. Get Classes ──
        const [classes] = await sequelize.query(`SELECT id, name FROM classes ORDER BY name`);
        console.log(`📋 Found ${(classes as any[]).length} classes\n`);

        for (const cls of classes as any[]) {
            const [countResult] = await sequelize.query(
                `SELECT COUNT(*)::int AS count FROM students WHERE "classId" = ${cls.id}`
            );
            const existingCount = (countResult as any[])[0].count;
            console.log(`   ${cls.name}: ${existingCount} existing students`);

            if (existingCount >= 10) {
                console.log(`   ⏭️  Skipping — already has enough students\n`);
                continue;
            }

            const nameList = cls.name === '7A' ? STUDENT_NAMES_7A :
                cls.name === '7B' ? STUDENT_NAMES_7B :
                    STUDENT_NAMES_7A;

            let created = 0;
            for (const s of nameList) {
                try {
                    await sequelize.query(
                        `INSERT INTO students (nis, name, "classId", gender, "createdAt", "updatedAt")
                         VALUES (:nis, :name, :classId, :gender, NOW(), NOW())
                         ON CONFLICT (nis) DO NOTHING`,
                        { replacements: { nis: s.nis, name: s.name, classId: cls.id, gender: s.gender } }
                    );
                    created++;
                } catch (err: any) {
                    console.error(`   ❌ Error: ${err.message}`);
                }
            }
            console.log(`   ✅ Processed ${created} students for ${cls.name}\n`);
        }

        // ── Summary ──
        console.log('\n' + '='.repeat(50));
        console.log('📊 FINAL STATE:');
        const [finalClasses] = await sequelize.query(`
            SELECT c.name AS class, COUNT(s.id)::int AS students
            FROM classes c
            LEFT JOIN students s ON s."classId" = c.id
            GROUP BY c.name ORDER BY c.name
        `);
        for (const row of finalClasses as any[]) {
            console.log(`   ${row.class}: ${row.students} students`);
        }
        const [subjects] = await sequelize.query(`SELECT name FROM subjects ORDER BY name`);
        console.log(`\n   Subjects: ${(subjects as any[]).map((s: any) => s.name).join(', ')}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

main();
