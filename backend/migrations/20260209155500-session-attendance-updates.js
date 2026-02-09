'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            // 1. Add qrCodeData to classes
            await queryInterface.addColumn('classes', 'qrCodeData', {
                type: Sequelize.STRING,
                allowNull: true,
            }, { transaction });

            // 2. Remove old unique constraint on teacher_attendance
            // Note: We try to remove the index by name. 
            // If the constraint was created as a specific name, we use that.
            // Based on previous model definition: name: 'unique_teacher_daily_attendance'
            try {
                await queryInterface.removeIndex('teacher_attendance', 'unique_teacher_daily_attendance', { transaction });
            } catch (err) {
                console.log('Index unique_teacher_daily_attendance might not exist or already removed');
            }

            // 3. Add Partial Unique Index for Regular Attendance (sessionId IS NULL)
            await queryInterface.addIndex('teacher_attendance', ['teacherId', 'date'], {
                unique: true,
                where: {
                    sessionId: null,
                },
                name: 'unique_teacher_regular_attendance',
                transaction,
            });

            // 4. Add Unique Index for Session Attendance (sessionId IS NOT NULL)
            // Actually, (teacherId, sessionId) is sufficient and strictly better, 
            // but to follow the plan we can include date. 
            // However, multiple sessions per day is allowed, just not same session twice.
            // So (teacherId, sessionId) must be unique.
            await queryInterface.addIndex('teacher_attendance', ['teacherId', 'sessionId'], {
                unique: true,
                where: {
                    sessionId: { [Sequelize.Op.ne]: null }
                },
                name: 'unique_teacher_session_attendance',
                transaction,
            });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            // Revert indexes
            await queryInterface.removeIndex('teacher_attendance', 'unique_teacher_regular_attendance', { transaction });
            await queryInterface.removeIndex('teacher_attendance', 'unique_teacher_session_attendance', { transaction });

            // Restore old index (caveat: this might fail if data violates it now)
            // await queryInterface.addIndex('teacher_attendance', ['teacherId', 'date'], {
            //   unique: true,
            //   name: 'unique_teacher_daily_attendance',
            //   transaction,
            // });

            // Remove column
            await queryInterface.removeColumn('classes', 'qrCodeData', { transaction });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};
