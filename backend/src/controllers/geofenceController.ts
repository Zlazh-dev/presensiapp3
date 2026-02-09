import { Request, Response } from 'express';
import { Geofence } from '../models';
import { calculateDistance } from '../utils/geofence';

/**
 * GET /api/geofence/status?lat=&lng=
 * Returns whether the coordinates are inside the geofence
 */
export const getGeofenceStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const lat = parseFloat(req.query.lat as string);
        const lng = parseFloat(req.query.lng as string);

        if (isNaN(lat) || isNaN(lng)) {
            res.status(400).json({ error: 'lat dan lng diperlukan' });
            return;
        }

        const geofence = await Geofence.findOne({ where: { isActive: true } });
        if (!geofence) {
            // No geofence configured — allow everything
            res.json({ inside: true, distance: 0, radiusMeters: 0, label: 'Tidak dikonfigurasi' });
            return;
        }

        const distance = calculateDistance(
            lat, lng,
            Number(geofence.latitude), Number(geofence.longitude)
        );

        res.json({
            inside: distance <= geofence.radiusMeters,
            distance: Math.round(distance),
            radiusMeters: geofence.radiusMeters,
            label: geofence.label,
        });
    } catch (error) {
        console.error('Get geofence status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/geofence
 * Returns the active geofence config
 */
export const getGeofence = async (_req: Request, res: Response): Promise<void> => {
    try {
        let geofence = await Geofence.findOne({ where: { isActive: true } });
        if (!geofence) {
            // Return defaults if none exists
            res.json({
                id: null,
                label: 'Sekolah',
                latitude: -7.936,
                longitude: 112.629,
                radiusMeters: 100,
                isActive: true,
            });
            return;
        }
        res.json(geofence);
    } catch (error) {
        console.error('Get geofence error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * PUT /api/geofence
 * Update or create the active geofence
 */
export const updateGeofence = async (req: Request, res: Response): Promise<void> => {
    try {
        const { label, latitude, longitude, radiusMeters } = req.body;

        if (latitude === undefined || longitude === undefined || radiusMeters === undefined) {
            res.status(400).json({ error: 'latitude, longitude, dan radiusMeters wajib diisi' });
            return;
        }

        if (radiusMeters < 10 || radiusMeters > 10000) {
            res.status(400).json({ error: 'Radius harus antara 10–10000 meter' });
            return;
        }

        let geofence = await Geofence.findOne({ where: { isActive: true } });
        if (geofence) {
            await geofence.update({
                label: label || geofence.label,
                latitude,
                longitude,
                radiusMeters,
            });
        } else {
            geofence = await Geofence.create({
                label: label || 'Sekolah',
                latitude,
                longitude,
                radiusMeters,
                isActive: true,
            } as any);
        }

        res.json({ message: 'Geofence berhasil diperbarui', geofence });
    } catch (error) {
        console.error('Update geofence error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
