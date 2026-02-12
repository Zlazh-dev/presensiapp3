import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as attendanceController from '../controllers/attendanceController';
import * as rekapController from '../controllers/rekapController';
import { scanGuruRegular, getGuruToday } from '../controllers/qrGuruController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// ── Multer config for assignment file uploads ──
const assignmentStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(__dirname, '../../uploads/assignments');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${timestamp}-${safeName}`);
    },
});

const assignmentUpload = multer({
    storage: assignmentStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Format file tidak didukung. Gunakan PDF, DOC, DOCX, JPG, atau PNG.'));
        }
    },
});

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
router.get('/guru/mengajar', authenticate, rekapController.getGuruMengajar);
router.get('/guru/class', authenticate, rekapController.getGuruClass);

// Rekap — Siswa
router.get('/siswa/summary', authenticate, rekapController.getSiswaSummary);
router.get('/siswa/:classId/detail', authenticate, rekapController.getSiswaDetail);

// Export
router.post('/export/:type', authenticate, authorize('admin'), rekapController.exportAttendance);

// ========== GURU DASHBOARD - IZIN/SAKIT ==========
// Submit leave request with optional file upload
router.post('/guru/submit-leave', authenticate, assignmentUpload.single('file'), attendanceController.submitLeave);
// Get leave history
router.get('/guru/leave-history', authenticate, attendanceController.getLeaveHistory);
// Download attachment
router.get('/guru/leave-attachment/:id', authenticate, attendanceController.getLeaveAttachment);

export default router;
