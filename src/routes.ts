import { Router } from 'express';
import authRouter from './modules/auth/auth.routes';
import mediaRouter from './modules/media/media.routes';
import companiesRouter from './modules/companies/companies.routes';
import propertiesRouter from './modules/properties/properties.routes';
import unitsRouter from './modules/units/units.routes';
import tenantsRouter from './modules/tenants/tenants.routes';
import vehiclesRouter from './modules/tenants/vehicles.routes';
import leasesRouter from './modules/leases/leases.routes';
import accountingRouter from './modules/accounting/accounting.routes';
import maintenanceRouter from './modules/maintenance/maintenance.routes';
import talCasesRouter from './modules/talCases/talCases.routes';
import communicationsRouter from './modules/communications/communications.routes';
import analyticsRouter from './modules/analytics/analytics.routes';
import extraRouter from './modules/extra/extra.routes';
import employeesRouter from './modules/employees/employees.routes';
import payrollRouter, { shiftsRouter, leavesRouter, overtimeRouter, runsRouter } from './modules/payroll/payroll.routes';
import tenantPortalRouter from './modules/tenantPortal/tenantPortal.routes';
import ownerPortalRouter from './modules/ownerPortal/ownerPortal.routes';
import ownersRouter from './modules/owners/owners.routes';
import coworkersRouter from './modules/coworkers/coworkers.routes';
import documentsRouter from './modules/documents/documents.routes';
import emailRouter from './modules/email/email.routes';
import { getAdminRentRoll, updatePotentialRent } from './modules/reports/rentRoll.controller';
import { getDashboardStats } from './modules/analytics/analytics.controller';
import {
  getReadinessDashboard,
  getReadinessBuildings,
  getReadinessStats,
  updateUnitReadiness,
} from './modules/units/units.controller';
import { authenticate } from './middlewares/auth.middleware';
import { authorizeRoles } from './middlewares/rbac.middleware';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    system: 'Horizex Property Pro REST API',
    timestamp: new Date().toISOString(),
  });
});

// Authentication
router.use('/auth', authRouter);

// Media Upload (Cloudinary Signed URLs & Base64 - No Multer)
router.use('/media', mediaRouter);

// Direct Dashboard & Readiness Aliases matching Frontend Client
router.get(
  '/admin/dashboard/stats',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER', 'ADMIN'),
  getDashboardStats
);
router.get(
  '/admin/readiness/dashboard',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'ADMIN'),
  getReadinessDashboard
);
router.get(
  '/admin/readiness/buildings',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'ADMIN'),
  getReadinessBuildings
);
router.get(
  '/admin/readiness/stats',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'ADMIN'),
  getReadinessStats
);
router.put(
  '/admin/readiness/update-step/:id',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'ADMIN'),
  updateUnitReadiness
);
router.put(
  '/admin/readiness/units/:id',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'ADMIN'),
  updateUnitReadiness
);

// Reports - Rent Roll Engine
router.get(
  '/admin/reports/rent-roll',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER', 'ADMIN'),
  getAdminRentRoll
);
router.put(
  '/admin/reports/potential-rent',
  authenticate,
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ADMIN'),
  updatePotentialRent
);

// Administrative & Operations Modules
router.use('/admin/companies', companiesRouter);
router.use('/admin/properties', propertiesRouter);
router.use('/admin/units', unitsRouter);
router.use('/admin/tenants', tenantsRouter);
router.use('/admin/vehicles', vehiclesRouter);
router.use('/admin/tenants/vehicles', vehiclesRouter);
router.use('/admin/leases', leasesRouter);
router.use('/admin', accountingRouter); // Mounts /payments, /invoices, /accounts, /outstanding-dues
router.use('/admin/tickets', maintenanceRouter);
router.use('/admin/tal-cases', talCasesRouter);
router.use('/admin/analytics', analyticsRouter);
router.use('/admin', extraRouter); // Mounts /unit-types, /insurance, /notes, /clock-in, /clock-out
router.use('/admin/employees', employeesRouter);
router.use('/employees', employeesRouter);
router.use('/admin/shifts', shiftsRouter);
router.use('/admin/leaves', leavesRouter);
router.use('/admin/overtime', overtimeRouter);
router.use('/admin/payroll/runs', runsRouter);
router.use('/admin/payroll', payrollRouter);
router.use('/admin', coworkersRouter); // Mounts /admin/coworkers and /admin/my-permissions
router.use('/admin', ownersRouter); // Mounts /admin/owners
router.use('/admin/documents', documentsRouter);
router.use('/admin/email', emailRouter);

// Communication
router.use('/communication', communicationsRouter);

// Portals
router.use('/tenant', tenantPortalRouter);
router.use('/owner', ownerPortalRouter);

export default router;
