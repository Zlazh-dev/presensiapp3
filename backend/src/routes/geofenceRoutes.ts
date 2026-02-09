import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { getGeofence, updateGeofence, getGeofenceStatus } from '../controllers/geofenceController';

const router = Router();

router.get('/status', authenticate, getGeofenceStatus);
router.get('/', authenticate, getGeofence);
router.put('/', authenticate, authorize('admin'), updateGeofence);

export default router;
