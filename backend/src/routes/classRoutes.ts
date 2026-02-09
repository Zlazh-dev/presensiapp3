import { Router } from 'express';
import multer from 'multer';
import * as classController from '../controllers/classController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Class CRUD
router.get('/', authenticate, classController.getAllClasses);
router.post('/', authenticate, authorize('admin'), classController.createClass);
router.put('/:id', authenticate, authorize('admin'), classController.updateClass);
router.delete('/:id', authenticate, authorize('admin'), classController.deleteClass);

// QR code for a class
router.get('/:id/qr', authenticate, classController.getClassQR);

// Active session for a class
router.get('/:id/active-session', authenticate, classController.getActiveSession);

// Submit student attendance for a class session
router.post('/:classId/student-attendance', authenticate, classController.submitStudentAttendance);

// ===== Class-scoped Student CRUD =====
router.get('/:id/students', authenticate, classController.getClassStudents);
router.post('/:id/students', authenticate, authorize('admin'), classController.addStudent);
router.put('/:id/students/:studentId', authenticate, authorize('admin'), classController.updateStudentInClass);
router.delete('/:id/students/:studentId', authenticate, authorize('admin'), classController.deleteStudentFromClass);

// Excel import
router.post('/:id/students-import', authenticate, authorize('admin'), upload.single('file'), classController.importStudents);

export default router;
