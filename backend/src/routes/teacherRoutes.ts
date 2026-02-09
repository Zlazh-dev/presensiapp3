import { Router } from 'express';
import * as teacherController from '../controllers/teacherController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, teacherController.getAllTeachers);
router.post('/', authenticate, authorize('admin'), teacherController.createTeacher);
router.put('/:id', authenticate, authorize('admin'), teacherController.updateTeacher);
router.delete('/:id', authenticate, authorize('admin'), teacherController.deleteTeacher);

export default router;
