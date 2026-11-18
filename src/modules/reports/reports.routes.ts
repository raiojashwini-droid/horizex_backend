import { Router } from 'express';
import {
  getCustomReport,
  getReportTemplates,
  saveReportTemplate,
  deleteReportTemplate,
  logReportAudit,
  getReportAuditLogs,
} from './reports.controller';
import { getAdminRentRoll, updatePotentialRent } from './rentRoll.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Rent Roll Endpoints
router.get(
  '/rent-roll',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER', 'ADMIN'),
  getAdminRentRoll
);

router.put(
  '/potential-rent',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ADMIN'),
  updatePotentialRent
);

// Custom Report Builder Queries
router.get('/custom-builder', getCustomReport);
router.post('/custom-builder', getCustomReport);

// Report Templates
router.get('/templates', getReportTemplates);
router.post('/templates', saveReportTemplate);
router.delete('/templates/:id', deleteReportTemplate);

// Audit Logs
router.get('/audit-logs', getReportAuditLogs);
router.post('/audit-logs', logReportAudit);

export default router;
