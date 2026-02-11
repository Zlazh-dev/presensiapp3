import rateLimit from 'express-rate-limit';

/**
 * Login rate limiter: max 5 attempts per 15 minutes per IP
 * Prevents brute-force attacks on login endpoint
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: {
        error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed login attempts
});

/**
 * General API rate limiter: max 100 requests per 15 minutes per IP
 * Protects all API routes from abuse
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    message: {
        error: 'Terlalu banyak request. Coba lagi nanti.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
