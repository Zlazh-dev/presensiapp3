import { Router } from 'express';
import * as scheduleController from '../controllers/scheduleController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// Guru Pengganti (Substitute Teacher) — must be before /:classId routes
router.get('/upcoming', authenticate, scheduleController.getUpcomingSessions);
router.get('/available-teachers', authenticate, scheduleController.getAvailableTeachers);
router.put('/:sessionId/substitute/:teacherId', authenticate, authorize('admin'), scheduleController.assignSubstitute);

// Existing CRUD
router.get('/', authenticate, scheduleController.getAllSchedules);
router.post('/', authenticate, authorize('admin'), scheduleController.createSchedule);
router.put('/:id', authenticate, authorize('admin'), scheduleController.updateSchedule);
router.delete('/:id', authenticate, authorize('admin'), scheduleController.deleteSchedule);

// New: Grid / Bulk / Export / Import
router.get('/:classId/grid', authenticate, scheduleController.getScheduleGrid);
router.post('/:classId/bulk', authenticate, authorize('admin'), scheduleController.bulkAssign);
router.post('/:classId/export-template', authenticate, scheduleController.exportTemplate);
router.post('/:classId/import', authenticate, authorize('admin'), scheduleController.uploadMiddleware, scheduleController.importSchedule);

export default router;

