import sequelize from './src/config/database';

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected. Dropping schema...');
        await sequelize.query('DROP SCHEMA public CASCADE');
        await sequelize.query('CREATE SCHEMA public');
        console.log('Schema reset complete. Tables cleared.');
    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await sequelize.close();
    }
})();
