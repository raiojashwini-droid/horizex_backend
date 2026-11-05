import { Router } from 'express';
import {
  listUnits,
  getUnit,
  getVacantBedrooms,
  createUnit,
  updateUnit,
  deleteUnit,
  getReadinessDashboard,
  updateUnitReadiness,
} from './units.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { createUnitSchema, updateUnitSchema, updateReadinessSchema } from './units.schema';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Readiness Dashboard & Updates
router.get(
  '/readiness/dashboard',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'),
  getReadinessDashboard
);

router.put(
  '/readiness/units/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'),
  validateRequest(updateReadinessSchema),
  updateUnitReadiness
);

// Units CRUD
router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'MAINTENANCE_STAFF', 'OWNER'),
  listUnits
);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(createUnitSchema),
  createUnit
);

router.get(
  '/bedrooms/vacant',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'MAINTENANCE_STAFF', 'OWNER', 'TENANT'),
  getVacantBedrooms
);

router.get(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'MAINTENANCE_STAFF', 'OWNER'),
  getUnit
);

router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(updateUnitSchema),
  updateUnit
);

router.delete(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  deleteUnit
);

export default router;

