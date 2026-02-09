import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import QRCode from 'qrcode';
import { Class } from '../models';

/**
 * Generate QR code for a class
 * GET /api/qr/class/:id
 */
export const generateClassQR = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const { format = 'png' } = req.query;

        const classData = await Class.findByPk(Number(id));

        if (!classData) {
            res.status(404).json({ error: 'Class not found' });
            return;
        }

        // QR data structure
        const qrData = JSON.stringify({
            type: 'class',
            id: classData.id,
            name: classData.name,
            level: classData.level,
        });

        if (format === 'png') {
            // Generate PNG image
            const qrImage = await QRCode.toDataURL(qrData, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                width: 300,
                margin: 1,
            });

            res.json({
                qrCode: qrImage,
                data: JSON.parse(qrData),
            });
        } else if (format === 'svg') {
            // Generate SVG
            const qrSvg = await QRCode.toString(qrData, {
                type: 'svg',
                errorCorrectionLevel: 'H',
                width: 300,
            });

            res.type('image/svg+xml');
            res.send(qrSvg);
        } else {
            res.status(400).json({ error: 'Invalid format. Use png or svg' });
        }
    } catch (error) {
        console.error('Generate class QR error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Generate QR code for teacher room or specific place
 * GET /api/qr/place/:place
 */
export const generatePlaceQR = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { format = 'png' } = req.query;
        const place = String(req.query.place || 'school');

        // Validate place
        const validPlaces = ['teacher-room', 'office', 'library', 'lab', 'canteen', 'school'];
        if (!validPlaces.includes(place)) {
            res.status(400).json({
                error: 'Invalid place',
                validPlaces
            });
            return;
        }

        // QR data structure
        const qrData = JSON.stringify({
            type: 'place',
            place: place,
            name: place.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        });

        if (format === 'png') {
            // Generate PNG image
            const qrImage = await QRCode.toDataURL(qrData, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                width: 300,
                margin: 1,
            });

            res.json({
                qrCode: qrImage,
                data: JSON.parse(qrData),
            });
        } else if (format === 'svg') {
            // Generate SVG
            const qrSvg = await QRCode.toString(qrData, {
                type: 'svg',
                errorCorrectionLevel: 'H',
                width: 300,
            });

            res.type('image/svg+xml');
            res.send(qrSvg);
        } else {
            res.status(400).json({ error: 'Invalid format. Use png or svg' });
        }
    } catch (error) {
        console.error('Generate place QR error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Generate QR code for a student (for their ID card)
 * GET /api/qr/student/:id
 */
export const generateStudentQR = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const { format = 'png' } = req.query;

        // In a real implementation, fetch student from database
        // For now, just generate QR with student ID

        const qrData = JSON.stringify({
            type: 'student',
            id: id,
        });

        if (format === 'png') {
            const qrImage = await QRCode.toDataURL(qrData, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                width: 300,
                margin: 1,
            });

            res.json({
                qrCode: qrImage,
                data: JSON.parse(qrData),
            });
        } else if (format === 'svg') {
            const qrSvg = await QRCode.toString(qrData, {
                type: 'svg',
                errorCorrectionLevel: 'H',
                width: 300,
            });

            res.type('image/svg+xml');
            res.send(qrSvg);
        } else {
            res.status(400).json({ error: 'Invalid format. Use png or svg' });
        }
    } catch (error) {
        console.error('Generate student QR error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Generate QR code for a teacher (for their ID card)
 * GET /api/qr/teacher/:id
 */
export const generateTeacherQR = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const { format = 'png' } = req.query;

        const qrData = JSON.stringify({
            type: 'teacher',
            id: id,
        });

        if (format === 'png') {
            const qrImage = await QRCode.toDataURL(qrData, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                width: 300,
                margin: 1,
            });

            res.json({
                qrCode: qrImage,
                data: JSON.parse(qrData),
            });
        } else if (format === 'svg') {
            const qrSvg = await QRCode.toString(qrData, {
                type: 'svg',
                errorCorrectionLevel: 'H',
                width: 300,
            });

            res.type('image/svg+xml');
            res.send(qrSvg);
        } else {
            res.status(400).json({ error: 'Invalid format. Use png or svg' });
        }
    } catch (error) {
        console.error('Generate teacher QR error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
