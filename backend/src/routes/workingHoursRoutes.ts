import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import {
    getAllWorkingHours,
    getTeacherWorkingHours,
    createWorkingHours,
    updateWorkingHours,
    deleteWorkingHours,
    toggleDay,
    bulkUpdate,
} from '../controllers/workingHoursController';

const router = Router();

// All routes require admin auth
router.use(authenticate, authorize('admin'));

router.get('/', getAllWorkingHours);
router.get('/:teacherId', getTeacherWorkingHours);
router.post('/', createWorkingHours);
router.put('/toggle', toggleDay);
router.put('/bulk-update', bulkUpdate);
router.put('/:id', updateWorkingHours);
router.delete('/:id', deleteWorkingHours);

export default router;
