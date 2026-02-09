import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import QRCode from 'qrcode';
import { Class } from '../models';
import crypto from 'crypto';

/**
 * Generate (or regenerate) a persistent QR code for a class
 * POST /api/qr/class/:classId/generate
 * Requires Admin or Homeroom Teacher (check permission in route or here)
 */
export const generateClassQR = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { classId } = req.params;

        // Find class
        const cls = await Class.findByPk(Number(classId));
        if (!cls) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        // Generate a random token
        const token = crypto.randomBytes(16).toString('hex');

        // Save to DB
        await cls.update({ qrCodeData: token });

        // Construct QR Payload
        // We include class metadata + the secret token
        const qrPayload = JSON.stringify({
            type: 'class-session',
            id: cls.id,
            name: cls.name,
            token: token
        });

        // Generage QR Image
        const qrImage = await QRCode.toDataURL(qrPayload, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 400,
            margin: 2,
        });

        res.json({
            message: 'QR Code generated successfully',
            qrCode: qrImage,
            payload: JSON.parse(qrPayload)
        });

    } catch (error) {
        console.error('Generate class persistent QR error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get existing QR code for a class (if exists)
 * GET /api/qr/class/:classId/view
 */
export const getClassQR = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { classId } = req.params;

        const cls = await Class.findByPk(Number(classId));
        if (!cls) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        if (!cls.qrCodeData) {
            res.status(404).json({ error: 'QR Code belum digenerate untuk kelas ini' });
            return;
        }

        const qrPayload = JSON.stringify({
            type: 'class-session',
            id: cls.id,
            name: cls.name,
            token: cls.qrCodeData
        });

        const qrImage = await QRCode.toDataURL(qrPayload, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 400,
            margin: 2,
        });

        res.json({
            qrCode: qrImage,
            payload: JSON.parse(qrPayload)
        });

    } catch (error) {
        console.error('Get class persistent QR error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
