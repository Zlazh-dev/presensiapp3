import { Router } from 'express';
import {
    getAllUsers,
    validateUser,
    createUser,
    updateUser,
    deleteUser,
    getAllMapel,
    validateMapel,
    createMapel,
    updateMapel,
    deleteMapel,
    getAllGurus,
    getAllClasses,
    getDashboardStats,
    getRecentActivity,
    cleanupAttendance,
} from '../controllers/adminController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// ========== USER MANAGEMENT ==========

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with optional role filter
 * @access  Admin
 */
router.get('/users', getAllUsers);

/**
 * @route   POST /api/admin/users/validate
 * @desc    Validate user uniqueness (NIP, Email)
 * @access  Admin
 */
router.post('/users/validate', validateUser);

/**
 * @route   POST /api/admin/users
 * @desc    Create a new user
 * @access  Admin
 */
router.post('/users', createUser);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user
 * @access  Admin
 */
router.put('/users/:id', updateUser);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user
 * @access  Admin
 */
router.delete('/users/:id', deleteUser);

// ========== MATA PELAJARAN MANAGEMENT ==========

/**
 * @route   GET /api/admin/mapel
 * @desc    Get all mata pelajaran with teacher and class info
 * @access  Admin
 */
router.get('/mapel', getAllMapel);

/**
 * @route   POST /api/admin/mapel/validate
 * @desc    Validate mata pelajaran uniqueness (name, code)
 * @access  Admin
 */
router.post('/mapel/validate', validateMapel);

/**
 * @route   POST /api/admin/mapel
 * @desc    Create mata pelajaran
 * @access  Admin
 */
router.post('/mapel', createMapel);

/**
 * @route   PUT /api/admin/mapel/:id
 * @desc    Update mata pelajaran
 * @access  Admin
 */
router.put('/mapel/:id', updateMapel);

/**
 * @route   DELETE /api/admin/mapel/:id
 * @desc    Delete mata pelajaran
 * @access  Admin
 */
router.delete('/mapel/:id', deleteMapel);

// ========== DROPDOWN DATA ==========

/**
 * @route   GET /api/admin/gurus
 * @desc    Get all teachers for dropdown
 * @access  Admin
 */
router.get('/gurus', getAllGurus);

/**
 * @route   GET /api/admin/classes
 * @desc    Get all classes for dropdown
 * @access  Admin
 */
router.get('/classes', getAllClasses);

// ========== DASHBOARD STATS ==========

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Admin
 */
router.get('/stats', getDashboardStats);

/**
 * @route   GET /api/dashboard/recent
 * @desc    Get recent activity
 * @access  Admin
 */
router.get('/recent', getRecentActivity);

// ========== DATA CLEANUP ==========

/**
 * @route   POST /api/admin/cleanup-attendance
 * @desc    Delete attendance records (by date range or all)
 * @access  Admin only
 */
router.post('/cleanup-attendance', cleanupAttendance);

// ========== AUTO-FILL ALPHA ==========

import { triggerAutoFillAlpha } from '../controllers/attendanceController';

/**
 * @route   POST /api/admin/trigger-alpha-fill
 * @desc    Manually trigger auto-fill alpha for absent teachers
 * @access  Admin only
 * @body    { date?: string } - Optional date to process (defaults to yesterday)
 */
router.post('/trigger-alpha-fill', triggerAutoFillAlpha);

// ========== DATA INTEGRITY MONITORING ==========

import { sessionManager } from '../services/SessionManager';

/**
 * @route   GET /api/admin/data-integrity
 * @desc    Get data integrity metrics for monitoring dashboard
 * @access  Admin only
 * @returns { duplicateActiveSessions, orphanedAttendance, activeSessionsCount, lastCheckTime }
 */
router.get('/data-integrity', async (req, res) => {
    try {
        const metrics = await sessionManager.getDataIntegrityMetrics();
        res.json({
            ...metrics,
            lastCheckTime: new Date().toISOString(),
            status: metrics.duplicateActiveSessions === 0 ? 'healthy' : 'warning'
        });
    } catch (error) {
        console.error('[data-integrity] Error:', error);
        res.status(500).json({ error: 'Failed to get data integrity metrics' });
    }
});

// ========== BACKUP ==========

import { backupAllData, getBackupInfo, restoreData } from '../controllers/backupController';

/**
 * @route   GET /api/admin/backup
 * @desc    Download full database backup as JSON
 * @access  Admin only
 */
router.get('/backup', backupAllData);

/**
 * @route   GET /api/admin/backup/info
 * @desc    Get table counts for backup preview
 * @access  Admin only
 */
router.get('/backup/info', getBackupInfo);

/**
 * @route   POST /api/admin/restore
 * @desc    Restore database from JSON backup file
 * @access  Admin only
 * @body    Full backup JSON object with confirmText: 'RESTORE DATA'
 */
import express from 'express';
router.post('/restore', express.json({ limit: '50mb' }), restoreData);

export default router;
