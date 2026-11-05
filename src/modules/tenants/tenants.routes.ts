import { Router } from 'express';
import {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  deleteTenant,
  sendTenantInvite,
  listVehicles,
  createVehicle,
} from './tenants.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  createTenantSchema,
  updateTenantSchema,
  createVehicleSchema,
} from './tenants.schema';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Vehicle permits
router.get(
  '/vehicles',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'),
  listVehicles
);

router.post(
  '/vehicles',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'TENANT'),
  validateRequest(createVehicleSchema),
  createVehicle
);

// Tenants CRUD
router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'),
  listTenants
);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(createTenantSchema),
  createTenant
);

router.get(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'TENANT'),
  getTenant
);

router.post(
  '/:id/send-invite',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  sendTenantInvite
);

router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(updateTenantSchema),
  updateTenant
);

router.delete(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  deleteTenant
);

export default router;
