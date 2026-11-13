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
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER', 'ADMIN'),
  listProperties
);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'),
  validateRequest(createPropertySchema),
  createProperty
);

router.get(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER', 'ADMIN'),
  getProperty
);

router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ADMIN'),
  validateRequest(updatePropertySchema),
  updateProperty
);

router.delete(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'),
  deleteProperty
);

export default router;

