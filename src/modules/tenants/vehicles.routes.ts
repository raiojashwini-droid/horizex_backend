import { Router } from 'express';
import {
  listVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from './tenants.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { createVehicleSchema, updateVehicleSchema } from './tenants.schema';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'),
  listVehicles
);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'TENANT'),
  validateRequest(createVehicleSchema),
  createVehicle
);

router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(updateVehicleSchema),
  updateVehicle
);

router.delete(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  deleteVehicle
);

export default router;

