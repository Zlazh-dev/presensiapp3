import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
    checkInSession,
    saveStudentAttendance,
    checkOutSession,
    getMyActiveSession,
    getMyCurrentSession
} from '../controllers/sessionController';

const router = Router();

router.use(authenticate);

// Teacher check-in to session
router.post('/check-in', checkInSession);

// Save student attendance (bulk)
router.post('/:id/student-attendance', saveStudentAttendance);

// Teacher check-out
router.post('/:id/check-out', checkOutSession);

// Get current active session
router.get('/my-active', getMyActiveSession);

// Get current session status + timing (New Strict Logic)
router.get('/my-current', getMyCurrentSession);

export default router;
