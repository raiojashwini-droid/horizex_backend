import { Router } from 'express';
import {
  listCases,
  getCase,
  createCase,
  scheduleHearing,
} from './talCases.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { createTalCaseSchema, scheduleHearingSchema } from './talCases.schema';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  listCases
);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(createTalCaseSchema),
  createCase
);

router.get(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  getCase
);

router.post(
  '/:id/hearings',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(scheduleHearingSchema),
  scheduleHearing
);

export default router;

