import { Router } from 'express';
import * as studentController from '../controllers/studentController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, studentController.getAllStudents);
router.post('/', authenticate, authorize('admin'), studentController.createStudent);
router.put('/:id', authenticate, authorize('admin'), studentController.updateStudent);
router.delete('/:id', authenticate, authorize('admin'), studentController.deleteStudent);

export default router;
