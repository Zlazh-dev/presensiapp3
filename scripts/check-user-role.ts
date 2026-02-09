
import User from '../backend/src/models/User';

async function checkRole() {
    try {
        const user = await User.findOne({ where: { username: 'guru1' } });
        if (user) {
            console.log('User found:', user.username);
            console.log('Role is:', user.role);
        } else {
            console.log('User guru1 not found');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

checkRole();
