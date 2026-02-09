import { Request, Response, NextFunction } from 'express';
import { ActivityLog } from '../models';
import { AuthRequest } from './auth';

/**
 * Middleware to log all CRUD operations to activity_logs table
 * Automatically captures user, action, and changes
 */
export const auditLog = (action: string, tableName: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        const originalJson = res.json.bind(res);
        const userId = req.user?.id;
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        // Capture the response data
        res.json = function (data: any) {
            // Log async to avoid blocking response
            setImmediate(async () => {
                try {
                    const recordId = data?.id || req.params?.id;
                    const logData: any = {
                        userId,
                        action,
                        tableName,
                        recordId: recordId ? parseInt(recordId) : null,
                        ipAddress,
                        userAgent,
                    };

                    // For CREATE operations, log new values
                    if (action === 'CREATE' && data) {
                        logData.newValues = data;
                    }

                    // For UPDATE operations, capture both old and new
                    if (action === 'UPDATE' && req.body) {
                        logData.newValues = req.body;
                        // Old values would need to be captured before the update
                    }

                    // For DELETE operations, log the deleted record ID
                    if (action === 'DELETE') {
                        logData.oldValues = { id: recordId };
                    }

                    await ActivityLog.create(logData);
                } catch (error) {
                    console.error('Failed to create activity log:', error);
                    // Don't fail the request if logging fails
                }
            });

            return originalJson(data);
        };

        next();
    };
};

/**
 * Middleware to log login attempts
 */
export const logLogin = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
        setImmediate(async () => {
            if (data.token && data.user) {
                try {
                    await ActivityLog.create({
                        userId: data.user.id,
                        action: 'LOGIN',
                        tableName: 'users',
                        recordId: data.user.id,
                        ipAddress: req.ip || req.socket.remoteAddress,
                        userAgent: req.headers['user-agent'],
                        newValues: { username: data.user.username },
                    });
                } catch (error) {
                    console.error('Failed to log login:', error);
                }
            }
        });

        return originalJson(data);
    };

    next();
};
