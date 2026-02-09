import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/seed-test-users', authController.seedTestUsers); // Temporary for testing
router.get('/test-users', authController.getTestUsers); // Debug: list seeded users

export default router;
