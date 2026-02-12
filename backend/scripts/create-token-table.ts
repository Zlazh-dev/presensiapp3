import { RegistrationToken } from '../src/models';
import sequelize from '../src/config/database';

const run = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        console.log('Syncing RegistrationToken table...');
        await RegistrationToken.sync({ alter: true });
        console.log('RegistrationToken table synced successfully.');

        process.exit(0);
    } catch (error) {
        console.error('Error syncing table:', error);
        process.exit(1);
    }
};

run();
