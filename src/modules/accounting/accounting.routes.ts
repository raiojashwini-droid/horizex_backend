import { Router } from 'express';
import {
  recordPayment,
  createInvoice,
  listInvoices,
  listPaymentsReceived,
  getOutstandingDues,
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from './accounting.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { recordPaymentSchema, createBankAccountSchema, updateBankAccountSchema } from './accounting.schema';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Single Place to Collect Rent
router.post(
  '/payments',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'TENANT'),
  validateRequest(recordPaymentSchema),
  recordPayment
);

router.get(
  '/payments-received',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'),
  listPaymentsReceived
);

router.get(
  '/payments',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'),
  listPaymentsReceived
);

router.get(
  '/invoices',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'TENANT', 'OWNER'),
  listInvoices
);

router.post(
  '/invoices',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT'),
  createInvoice
);

router.get(
  '/outstanding-dues',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'),
  getOutstandingDues
);

// Bank accounts
router.get(
  '/accounts',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTANT'),
  listBankAccounts
);

router.post(
  '/accounts',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTANT'),
  validateRequest(createBankAccountSchema),
  createBankAccount
);

router.put(
  '/accounts/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTANT'),
  validateRequest(updateBankAccountSchema),
  updateBankAccount
);

router.patch(
  '/accounts/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTANT'),
  validateRequest(updateBankAccountSchema),
  updateBankAccount
);

router.delete(
  '/accounts/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTANT'),
  deleteBankAccount
);

export default router;

