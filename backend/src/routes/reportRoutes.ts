import { Router } from 'express';
import * as reportController from '../controllers/reportController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.get('/attendance/csv', authenticate, authorize('admin'), reportController.exportCSV);
router.get('/attendance/xlsx', authenticate, authorize('admin'), reportController.exportXLSX);

export default router;
