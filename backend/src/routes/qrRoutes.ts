import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
    generateClassQR,
    generatePlaceQR,
    generateStudentQR,
    generateTeacherQR,
} from '../controllers/qrController';
import { generateGuruRoomQR } from '../controllers/qrGuruController';
import { generateClassQR as generatePersistentClassQR, getClassQR } from '../controllers/classQRController';


const router = Router();

// All QR routes require authentication
router.use(authenticate);

// Static Guru Room QR — single QR for all teachers
router.get('/guru-room', generateGuruRoomQR);

// Generate QR for class (Dynamic/Standard) - Existing
router.get('/class/:id', generateClassQR);

// Generate PERSISTENT QR for class (Admin/Guru) — NEW
router.post('/class/:classId/generate', generatePersistentClassQR);
router.get('/class/:classId/view', getClassQR);


// Generate QR for place (teacher-room, office, etc.)
router.get('/place/:place', generatePlaceQR);

// Generate QR for student
router.get('/student/:id', generateStudentQR);

// Generate QR for teacher
router.get('/teacher/:id', generateTeacherQR);

export default router;
