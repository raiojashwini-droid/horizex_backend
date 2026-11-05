import { z } from 'zod';

export const recordPaymentSchema = z.object({
  body: z.object({
    invoiceId: z.string().uuid().optional(),
    tenantId: z.string().uuid('Valid tenant ID is required'),
    bankAccountId: z.string().uuid('Valid bank account ID is required'),
    amount: z.number().positive('Payment amount must be greater than 0'),
    paymentMethod: z.enum([
      'INTERAC_E_TRANSFER',
      'CREDIT_CARD',
      'PRE_AUTHORIZED_DEBIT',
      'BANK_TRANSFER',
      'CHEQUE',
      'CASH',
    ]),
    referenceId: z.string().optional(),
  }),
});

export const createInvoiceSchema = z.object({
  body: z.object({
    leaseId: z.string().uuid('Valid lease ID is required'),
    tenantId: z.string().uuid('Valid tenant ID is required'),
    amountDue: z.number().positive('Amount due must be positive'),
    dueDate: z.string().datetime('Valid due date is required'),
  }),
});

export const createBankAccountSchema = z.object({
  body: z.object({
    companyId: z.string().optional(),
    bankName: z.string().optional().default('General Ledger'),
    accountName: z.string().min(1, 'Account name is required'),
    accountNumber: z.string().min(1, 'Account number is required'),
    routingNumber: z.string().optional(),
    assetType: z.string().optional(),
    initialBalance: z.number().nonnegative().optional().default(0),
    openingBalance: z.union([z.number(), z.string()]).optional(),
  }),
});

export const updateBankAccountSchema = z.object({
  body: z.object({
    companyId: z.string().optional(),
    bankName: z.string().optional(),
    accountName: z.string().optional(),
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    assetType: z.string().optional(),
    balance: z.number().optional(),
    openingBalance: z.union([z.number(), z.string()]).optional(),
  }),
});

