import { Router } from 'express';
import * as timeSlotController from '../controllers/timeSlotController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, timeSlotController.getAllTimeSlots);
router.post('/', authenticate, authorize('admin'), timeSlotController.createTimeSlot);
router.put('/:id', authenticate, authorize('admin'), timeSlotController.updateTimeSlot);
router.delete('/:id', authenticate, authorize('admin'), timeSlotController.deleteTimeSlot);
router.post('/seed', authenticate, authorize('admin'), timeSlotController.seedTimeSlots);

export default router;
