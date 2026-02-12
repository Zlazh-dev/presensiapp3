import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { loginLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticate, authController.getMe);

// QR Code / Token Registration
router.post('/tokens', authenticate, authController.generateRegistrationToken); // Admin only (add role check later or in controller)
router.get('/tokens', authenticate, authController.getRegistrationTokens);
router.get('/validate-token/:token', authController.validateToken); // Public
router.post('/register-with-token', authController.registerWithToken); // Public

// Debug endpoints — only available in development
if (process.env.NODE_ENV !== 'production') {
    router.post('/seed-test-users', authController.seedTestUsers);
    router.get('/test-users', authController.getTestUsers);
}

export default router;
