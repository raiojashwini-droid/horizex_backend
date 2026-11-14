import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';

export class AccountingService {
  /**
   * THE "SINGLE PLACE TO COLLECT RENT" (BUSINESS_RULES.md Section 3)
   * Double-Entry Transaction:
   * 1. Records Payment
   * 2. Updates Invoice amountPaid & status
   * 3. Credits BankAccount balance
   * 4. Converts excess overpayment to TenantCredit
   * 5. Emits immutable AuditLog
   */
  static async recordPayment(
    data: {
      invoiceId?: string;
      tenantId?: string;
      bankAccountId?: string;
      amount: number;
      paymentMethod?: any;
      referenceId?: string;
    },
    companyId?: string | null,
    actorUserId?: string
  ) {
    let invoiceToSettle: any = null;
    if (data.invoiceId) {
      invoiceToSettle = await prisma.invoice.findUnique({
        where: { id: data.invoiceId },
        include: { tenant: true },
      });
    }

    const resolvedTenantId = data.tenantId || invoiceToSettle?.tenantId;
    if (!resolvedTenantId) {
      throw new AppError('Tenant not found or access denied', 404, 'TENANT_NOT_FOUND');
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        id: resolvedTenantId,
        isActive: true,
        ...(companyId ? { companyId } : {}),
      },
    });

    if (!tenant) {
      throw new AppError('Tenant not found or access denied', 404, 'TENANT_NOT_FOUND');
    }

    let bankAccount = null;
    if (data.bankAccountId) {
      bankAccount = await prisma.bankAccount.findFirst({
        where: {
          id: data.bankAccountId,
          isActive: true,
          ...(companyId ? { companyId } : {}),
        },
      });
    }

    if (!bankAccount) {
      bankAccount = await prisma.bankAccount.findFirst({
        where: {
          isActive: true,
          ...(companyId || tenant.companyId ? { companyId: companyId || tenant.companyId } : {}),
        },
      }) || await prisma.bankAccount.findFirst({ where: { isActive: true } });
    }

    if (!bankAccount) {
      bankAccount = await prisma.bankAccount.create({
        data: {
          companyId: tenant.companyId,
          bankName: 'Operating Account',
          accountName: 'General Operating Account',
          accountNumber: '0144-8829-10',
          balance: 0,
          isActive: true,
        },
      });
    }

    // Normalize paymentMethod enum
    const methodStr = String(data.paymentMethod || '').toUpperCase().replace(/[\s-]/g, '_');
    const validMethods = ['INTERAC_E_TRANSFER', 'CREDIT_CARD', 'PRE_AUTHORIZED_DEBIT', 'BANK_TRANSFER', 'CHEQUE', 'CASH'];
    const resolvedMethod: any = validMethods.includes(methodStr) ? methodStr : 'INTERAC_E_TRANSFER';

    if (!invoiceToSettle) {
      // If invoiceId not specified, find oldest unpaid/partially paid invoice
      invoiceToSettle = await prisma.invoice.findFirst({
        where: {
          tenantId: tenant.id,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        orderBy: { dueDate: 'asc' },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoiceToSettle?.id || null,
          tenantId: tenant.id,
          bankAccountId: bankAccount.id,
          amount: data.amount,
          paymentMethod: resolvedMethod,
          status: 'COMPLETED',
          referenceId: data.referenceId,
          paidAt: new Date(),
        },
      });

      // 2. Credit Bank Account
      await tx.bankAccount.update({
        where: { id: bankAccount.id },
        data: {
          balance: { increment: data.amount },
        },
      });

      // 3. Settle invoice & handle excess/credit
      if (invoiceToSettle) {
        const remainingDue = Number(invoiceToSettle.amountDue) - Number(invoiceToSettle.amountPaid);

        if (data.amount >= remainingDue) {
          // Fully paid
          await tx.invoice.update({
            where: { id: invoiceToSettle.id },
            data: {
              amountPaid: invoiceToSettle.amountDue,
              status: 'PAID',
            },
          });

          // Overpayment rule: Store excess as TenantCredit
          const excess = data.amount - remainingDue;
          if (excess > 0) {
            await tx.tenantCredit.create({
              data: {
                tenantId: tenant.id,
                amount: excess,
                reason: `Overpayment on invoice ${invoiceToSettle.invoiceNumber}`,
              },
            });
          }
        } else {
          // Partially paid
          await tx.invoice.update({
            where: { id: invoiceToSettle.id },
            data: {
              amountPaid: { increment: data.amount },
              status: 'PARTIALLY_PAID',
            },
          });
        }
      }

      return payment;
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'RECORD_PAYMENT',
      entityType: 'Payment',
      entityId: result.id,
      newData: result,
    });

    return result;
  }

  static async createInvoice(data: {
    leaseId: string;
    amount?: number;
    amountDue?: number;
    dueDate: string | Date;
    category?: string;
    description?: string;
  }) {
    const lease = await prisma.lease.findUnique({
      where: { id: data.leaseId },
      include: { tenant: true },
    });
    if (!lease) {
      throw new AppError('Lease agreement not found', 404);
    }
    const tenantId = lease.tenantId;
    const amount = Number(data.amount ?? data.amountDue ?? lease.rentAmount);
    const invoiceCount = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, '0')}`;

    return prisma.invoice.create({
      data: {
        leaseId: data.leaseId,
        tenantId,
        invoiceNumber,
        amountDue: amount,
        amountPaid: 0,
        dueDate: new Date(data.dueDate),
        status: 'UNPAID',
        category: data.category || 'RENT',
      },
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        lease: {
          include: {
            unit: {
              select: {
                unitNumber: true,
                propertyId: true,
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  static async updateInvoice(id: string, data: { amount?: number; dueDate?: string | Date; status?: any }) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    const updateData: any = {};
    if (data.amount !== undefined) {
      updateData.amountDue = Number(data.amount);
    }
    if (data.dueDate) {
      updateData.dueDate = new Date(data.dueDate);
    }
    if (data.status) {
      updateData.status = data.status;
    }
    return prisma.invoice.update({
      where: { id },
      data: updateData,
    });
  }

  static async deleteInvoice(id: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    await prisma.payment.deleteMany({ where: { invoiceId: id } });
    return prisma.invoice.delete({ where: { id } });
  }

  static async duplicateInvoice(id: string) {
    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { tenant: true },
    });
    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }

    const invoiceCount = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, '0')}`;

    const nextDueDate = new Date(existing.dueDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    return prisma.invoice.create({
      data: {
        leaseId: existing.leaseId,
        tenantId: existing.tenantId,
        invoiceNumber,
        amountDue: existing.amountDue,
        amountPaid: 0,
        dueDate: nextDueDate,
        status: 'UNPAID',
        category: existing.category || 'RENT',
      },
    });
  }

  static async listInvoices(filters: {
    companyId?: string | null;
    status?: any;
    tenantId?: string;
  }) {
    const where: any = {};
    if (filters.companyId) {
      where.tenant = { companyId: filters.companyId };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.tenantId) {
      where.tenantId = filters.tenantId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
        lease: {
          include: {
            unit: {
              select: {
                unitNumber: true,
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
        payments: true,
      },
      orderBy: { dueDate: 'desc' },
    });

    return invoices.map((inv) => {
      const tenantName = inv.tenant ? `${inv.tenant.firstName || ''} ${inv.tenant.lastName || ''}`.trim() : 'Unknown';
      const buildingName = inv.lease?.unit?.property?.name || 'Property';
      const unitNumber = inv.lease?.unit?.unitNumber || '-';
      const propertyId = inv.lease?.unit?.property?.id;
      const amountDue = Number(inv.amountDue);
      const amountPaid = Number(inv.amountPaid || 0);
      const outstandingBalance = Math.max(0, amountDue - amountPaid);
      const dueDateFormatted = inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : 'N/A';

      return {
        ...inv,
        invoiceNo: inv.invoiceNumber,
        invoiceNumber: inv.invoiceNumber,
        invoice: inv.invoiceNumber,
        propertyName: buildingName,
        buildingName,
        building: buildingName,
        propertyId,
        unitNumber,
        unit: unitNumber,
        tenantName,
        tenant: tenantName,
        amountDue,
        amountPaid,
        outstandingBalance,
        balance: outstandingBalance,
        dueDate: dueDateFormatted,
        status: inv.status,
      };
    });
  }

  static async listPaymentsReceived(companyId?: string | null) {
    const where: any = {};
    if (companyId) {
      where.tenant = { companyId };
    }

    return prisma.payment.findMany({
      where,
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
        bankAccount: { select: { id: true, accountName: true, bankName: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  static async getOutstandingDues(companyId?: string | null) {
    const where: any = {
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
    };
    if (companyId) {
      where.tenant = { companyId };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        lease: {
          include: {
            unit: {
              select: {
                unitNumber: true,
                propertyId: true,
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();

    return invoices.map((inv) => {
      const balance = Number(inv.amountDue) - Number(inv.amountPaid);
      const diffTime = now.getTime() - new Date(inv.dueDate).getTime();
      const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      let agingBucket = 'CURRENT';
      if (daysOverdue > 90) agingBucket = '90+_DAYS';
      else if (daysOverdue > 60) agingBucket = '60_DAYS';
      else if (daysOverdue > 30) agingBucket = '30_DAYS';

      const tenantName = inv.tenant ? `${inv.tenant.firstName || ''} ${inv.tenant.lastName || ''}`.trim() : 'Tenant';
      const unitNumber = inv.lease?.unit?.unitNumber ? `Unit ${inv.lease.unit.unitNumber}` : 'Unit';
      const propertyId = inv.lease?.unit?.propertyId || (inv.lease?.unit?.property as any)?.id;
      const propertyName = inv.lease?.unit?.property?.name || 'Property';

      return {
        ...inv,
        invoice: inv.invoiceNumber,
        tenant: tenantName,
        tenantObj: inv.tenant,
        unit: unitNumber,
        propertyId,
        propertyName,
        category: (inv as any).category || 'RENT',
        leaseType: inv.lease ? 'Full Unit' : 'Other',
        amount: Math.round(balance * 100) / 100,
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : 'N/A',
        status: inv.status === 'OVERDUE' ? 'Overdue' : inv.status === 'PARTIALLY_PAID' ? 'Partial' : 'Pending',
        balanceRemaining: Math.round(balance * 100) / 100,
        daysOverdue,
        agingBucket,
      };
    });
  }

  static async listBankAccounts(companyId?: string | null) {
    const where: any = { isActive: true };
    if (companyId) {
      where.companyId = companyId;
    }

    return prisma.bankAccount.findMany({
      where,
      include: {
        _count: { select: { payments: true } },
        company: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createBankAccount(
    data: {
      companyId: string;
      bankName?: string;
      accountName: string;
      accountNumber: string;
      routingNumber?: string;
      assetType?: string;
      initialBalance?: number;
      openingBalance?: number | string;
    },
    actorUserId?: string
  ) {
    const bankName = data.bankName || data.assetType || 'General Ledger';
    const routingNumber = data.routingNumber || data.assetType || '001-00000';
    const initialBal = data.initialBalance ?? (data.openingBalance ? Number(data.openingBalance) : 0);

    const account = await prisma.bankAccount.create({
      data: {
        companyId: data.companyId,
        bankName,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        routingNumber,
        balance: initialBal,
      },
      include: {
        company: { select: { id: true, name: true, code: true } },
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'CREATE_BANK_ACCOUNT',
      entityType: 'BankAccount',
      entityId: account.id,
      newData: account,
    });

    return account;
  }

  static async updateBankAccount(
    id: string,
    data: {
      bankName?: string;
      accountName?: string;
      accountNumber?: string;
      routingNumber?: string;
      assetType?: string;
      balance?: number;
      openingBalance?: number | string;
      companyId?: string;
    },
    actorUserId?: string
  ) {
    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Bank account not found', 404, 'ACCOUNT_NOT_FOUND');
    }

    const bankName = data.bankName !== undefined ? data.bankName : (data.assetType !== undefined ? data.assetType : existing.bankName);
    const routingNumber = data.routingNumber !== undefined ? data.routingNumber : (data.assetType !== undefined ? data.assetType : existing.routingNumber);
    const balance = data.balance !== undefined ? data.balance : (data.openingBalance !== undefined ? Number(data.openingBalance) : existing.balance);

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: {
        bankName,
        accountName: data.accountName !== undefined ? data.accountName : existing.accountName,
        accountNumber: data.accountNumber !== undefined ? data.accountNumber : existing.accountNumber,
        routingNumber,
        balance,
        companyId: data.companyId !== undefined ? data.companyId : existing.companyId,
      },
      include: {
        company: { select: { id: true, name: true, code: true } },
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_BANK_ACCOUNT',
      entityType: 'BankAccount',
      entityId: updated.id,
      oldData: existing,
      newData: updated,
    });

    return updated;
  }

  static async deleteBankAccount(id: string, actorUserId?: string) {
    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Bank account not found', 404, 'ACCOUNT_NOT_FOUND');
    }

    const deleted = await prisma.bankAccount.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'DELETE_BANK_ACCOUNT',
      entityType: 'BankAccount',
      entityId: id,
      oldData: existing,
    });

    return { success: true, message: 'Bank account deleted successfully' };
  }
}

