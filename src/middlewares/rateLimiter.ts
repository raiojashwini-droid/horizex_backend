import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse.util';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 300 : 50000, // Generous limit in dev to avoid 429 during active development
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      'TOO_MANY_REQUESTS',
      'Too many requests from this IP, please try again after 15 minutes',
      429
    );
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 login/refresh attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      'AUTH_RATE_LIMIT_EXCEEDED',
      'Too many login attempts, please try again after 15 minutes',
      429
    );
  },
});

