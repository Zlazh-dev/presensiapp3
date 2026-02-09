import { Router } from 'express';
import * as holidayController from '../controllers/holidayController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, authorize('admin'), holidayController.getAllHolidays);
router.get('/active', authenticate, holidayController.getActiveHolidays);
router.post('/', authenticate, authorize('admin'), holidayController.createHoliday);
router.put('/:id', authenticate, authorize('admin'), holidayController.updateHoliday);
router.delete('/:id', authenticate, authorize('admin'), holidayController.deleteHoliday);
router.post('/import', authenticate, authorize('admin'), holidayController.importHolidays);
router.post('/seed', authenticate, authorize('admin'), holidayController.seedHolidays);

export default router;
