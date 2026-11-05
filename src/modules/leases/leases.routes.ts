import { Router } from 'express';
import {
  listLeases,
  listRenewals,
  getLease,
  createLease,
  renewLease,
  addMoveInspection,
  deleteLease,
} from './leases.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  createLeaseSchema,
  renewLeaseSchema,
  createMoveInspectionSchema,
} from './leases.schema';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get(
  '/renewals',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'),
  listRenewals
);

router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'),
  listLeases
);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(createLeaseSchema),
  createLease
);

router.get(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'TENANT', 'OWNER'),
  getLease
);

router.post(
  '/:id/renew',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(renewLeaseSchema),
  renewLease
);

router.post(
  '/:id/inspections',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'),
  validateRequest(createMoveInspectionSchema),
  addMoveInspection
);

router.delete(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  deleteLease
);

export default router;

