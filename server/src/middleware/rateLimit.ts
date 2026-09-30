import { rateLimit } from 'express-rate-limit';

function limiter(windowMinutes: number, limit: number, message: string, skipSuccessfulRequests = false) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { error: message },
  });
}

// Only failed attempts count, so a client who logs in normally never hits it
export const loginLimiter = limiter(15, 10, 'Too many failed login attempts. Please wait 15 minutes and try again.', true);

export const passwordResetLimiter = limiter(60, 5, 'Too many password reset requests. Please try again in an hour.');

export const registerLimiter = limiter(60, 10, 'Too many attempts. Please try again later.');
