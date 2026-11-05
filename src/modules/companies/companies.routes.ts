import { Router } from 'express';
import {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
} from './companies.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { createCompanySchema, updateCompanySchema } from './companies.schema';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  listCompanies
);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN'),
  validateRequest(createCompanySchema),
  createCompany
);

router.get(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  getCompany
);

router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN'),
  validateRequest(updateCompanySchema),
  updateCompany
);

router.delete(
  '/:id',
  authorizeRoles('SUPER_ADMIN'),
  deleteCompany
);

export default router;

