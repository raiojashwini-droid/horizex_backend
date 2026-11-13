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
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'ADMIN'),
  getReadinessDashboard
);

router.put(
  '/readiness/units/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'ADMIN'),
  validateRequest(updateReadinessSchema),
  updateUnitReadiness
);

// Units CRUD
router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'MAINTENANCE_STAFF', 'OWNER', 'ADMIN'),
  listUnits
);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ADMIN'),
  validateRequest(createUnitSchema),
  createUnit
);

router.get(
  '/bedrooms/vacant',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'MAINTENANCE_STAFF', 'OWNER', 'TENANT', 'ADMIN'),
  getVacantBedrooms
);

router.get(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'MAINTENANCE_STAFF', 'OWNER', 'ADMIN'),
  getUnit
);

router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ADMIN'),
  validateRequest(updateUnitSchema),
  updateUnit
);

router.delete(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ADMIN'),
  deleteUnit
);

export default router;

