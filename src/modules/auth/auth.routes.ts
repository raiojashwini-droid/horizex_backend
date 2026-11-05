import { Router } from 'express';
import { login, refresh, logout, getMe, getProfile, updateProfile } from './auth.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { loginSchema } from './auth.schema';
import { authLimiter } from '../../middlewares/rateLimiter';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// Public auth endpoints
router.post('/login', authLimiter, validateRequest(loginSchema), login);
router.post('/refresh', authLimiter, refresh);

// Protected auth endpoints
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);
router.put('/profile', authenticate, updateProfile);

export default router;

