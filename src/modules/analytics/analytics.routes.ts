import { Router } from 'express';
import {
  getDashboardStats,
  getRevenueTrajectory,
  getVacancyAnalytics,
} from './analytics.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get(
  '/dashboard/stats',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'),
  getDashboardStats
);

router.get(
  '/stats',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'),
  getDashboardStats
);

router.get(
  '/revenue',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTANT', 'OWNER'),
  getRevenueTrajectory
);

router.get(
  '/vacancy',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'OWNER'),
  getVacancyAnalytics
);

export default router;

