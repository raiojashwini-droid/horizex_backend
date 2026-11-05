import { Router } from 'express';
import {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
} from './properties.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { createPropertySchema, updatePropertySchema } from './properties.schema';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'),
  listProperties
);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  validateRequest(createPropertySchema),
  createProperty
);

router.get(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'),
  getProperty
);

router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(updatePropertySchema),
  updateProperty
);

router.delete(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  deleteProperty
);

export default router;

