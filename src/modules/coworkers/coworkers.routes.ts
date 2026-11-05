import { Router } from 'express';
import {
  getCoworkers,
  getMyPermissions,
  createCoworker,
  updateCoworker,
  updatePermissions,
  deleteCoworker,
  sendInvite,
} from './coworkers.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// 1. Current logged in user permissions (can be called by any authenticated user)
router.get('/my-permissions', authenticate, getMyPermissions);

// 2. Coworker management endpoints (ADMIN only)
router.get('/coworkers', authenticate, authorizeRoles('ADMIN'), getCoworkers);
router.post('/coworkers', authenticate, authorizeRoles('ADMIN'), createCoworker);
router.put('/coworkers/:id', authenticate, authorizeRoles('ADMIN'), updateCoworker);
router.put('/coworkers/:id/permissions', authenticate, authorizeRoles('ADMIN'), updatePermissions);
router.delete('/coworkers/:id', authenticate, authorizeRoles('ADMIN'), deleteCoworker);
router.post('/coworkers/:id/send-invite', authenticate, authorizeRoles('ADMIN'), sendInvite);

export default router;

