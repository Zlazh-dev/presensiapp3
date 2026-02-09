import { Router } from 'express';
import * as attendanceController from '../controllers/attendanceController';
import * as rekapController from '../controllers/rekapController';
import { scanGuruRegular, getGuruToday } from '../controllers/qrGuruController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// Existing
router.get('/', authenticate, attendanceController.getAttendanceByDate);
router.post('/', authenticate, attendanceController.recordAttendance);
router.post('/scan', authenticate, attendanceController.scanAttendance);

// Guru Regular — static QR scan (auto checkin/checkout)
router.post('/guru-regular-scan', authenticate, scanGuruRegular);

// Guru today status
router.get('/guru-today', authenticate, getGuruToday);

// Rekap — Guru
router.get('/guru/regular', authenticate, rekapController.getGuruRegular);
router.get('/guru/mengajar', authenticate, rekapController.getGuruMengajar); // Single Source of Truth for teaching attendance
router.get('/guru/class', authenticate, rekapController.getGuruClass);

// Rekap — Siswa
router.get('/siswa/summary', authenticate, rekapController.getSiswaSummary);
router.get('/siswa/:classId/detail', authenticate, rekapController.getSiswaDetail);

// Export
router.post('/export/:type', authenticate, authorize('admin'), rekapController.exportAttendance);

// ========== GURU DASHBOARD - IZIN/SAKIT ==========
// Submit leave request (sakit/izin)
router.post('/guru/submit-leave', authenticate, attendanceController.submitLeave);
// Get leave history
router.get('/guru/leave-history', authenticate, attendanceController.getLeaveHistory);

export default router;
