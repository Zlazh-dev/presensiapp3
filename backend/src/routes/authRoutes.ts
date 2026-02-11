import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { loginLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticate, authController.getMe);

// Debug endpoints — only available in development
if (process.env.NODE_ENV !== 'production') {
    router.post('/seed-test-users', authController.seedTestUsers);
    router.get('/test-users', authController.getTestUsers);
}

export default router;
