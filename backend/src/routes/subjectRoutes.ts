import { Router } from 'express';
import * as subjectController from '../controllers/subjectController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, subjectController.getAllSubjects);
router.post('/', authenticate, authorize('admin'), subjectController.createSubject);
router.put('/:id', authenticate, authorize('admin'), subjectController.updateSubject);
router.delete('/:id', authenticate, authorize('admin'), subjectController.deleteSubject);

export default router;
