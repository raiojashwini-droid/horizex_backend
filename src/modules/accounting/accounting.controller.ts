import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { AccountingService } from './accounting.service';
import { sendSuccess } from '../../utils/apiResponse.util';
import { AppError } from '../../middlewares/errorHandler';

export const recordPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.body.companyId || req.user?.effectiveCompanyId;

    const payment = await AccountingService.recordPayment(req.body, companyId, req.user?.userId);
    return sendSuccess(res, payment, 201);
  } catch (err) {
    return next(err);
  }
};

export const createInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await AccountingService.createInvoice(req.body);
    return sendSuccess(res, invoice, 201);
  } catch (err) {
    return next(err);
  }
};

export const listInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = (req.query.companyId as string) || (isSuperAdmin ? undefined : req.user?.effectiveCompanyId);

    const invoices = await AccountingService.listInvoices({
      companyId,
      status: req.query.status,
      tenantId: req.query.tenantId as string | undefined,
    });
    return sendSuccess(res, invoices, 200);
  } catch (err) {
    return next(err);
  }
};

export const listPaymentsReceived = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = (req.query.companyId as string) || (isSuperAdmin ? undefined : req.user?.effectiveCompanyId);

    const payments = await AccountingService.listPaymentsReceived(companyId);
    return sendSuccess(res, payments, 200);
  } catch (err) {
    return next(err);
  }
};

export const getOutstandingDues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = (req.query.companyId as string) || (isSuperAdmin ? undefined : req.user?.effectiveCompanyId);

    const dues = await AccountingService.getOutstandingDues(companyId);
    return sendSuccess(res, dues, 200);
  } catch (err) {
    return next(err);
  }
};

export const listBankAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = (req.query.companyId as string) || (isSuperAdmin ? undefined : req.user?.effectiveCompanyId);

    const accounts = await AccountingService.listBankAccounts(companyId);
    return sendSuccess(res, accounts, 200);
  } catch (err) {
    return next(err);
  }
};

export const createBankAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let companyId = req.body.companyId || req.user?.effectiveCompanyId;
    if (!companyId) {
      const firstComp = await prisma.company.findFirst({ select: { id: true } });
      companyId = firstComp?.id;
    }
    if (!companyId) {
      throw new AppError('companyId is required', 400, 'COMPANY_ID_REQUIRED');
    }

    const account = await AccountingService.createBankAccount(
      { ...req.body, companyId },
      req.user?.userId
    );
    return sendSuccess(res, account, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateBankAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await AccountingService.updateBankAccount(
      req.params.id,
      req.body,
      req.user?.userId
    );
    return sendSuccess(res, updated, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteBankAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await AccountingService.deleteBankAccount(
      req.params.id,
      req.user?.userId
    );
    return sendSuccess(res, deleted, 200);
  } catch (err) {
    return next(err);
  }
};

