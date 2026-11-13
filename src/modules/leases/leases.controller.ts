import { Request, Response, NextFunction } from 'express';
import { LeasesService } from './leases.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const listRenewals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const renewals = await LeasesService.listRenewals(companyId);
    return sendSuccess(res, renewals, 200);
  } catch (err) {
    return next(err);
  }
};

export const getRenewal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const renewal = await LeasesService.getRenewalById(req.params.id, companyId);
    return sendSuccess(res, renewal, 200);
  } catch (err) {
    return next(err);
  }
};

export const sendRenewalNotice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const result = await LeasesService.sendRenewalNotice(req.params.id, companyId, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const updateRenewalStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const result = await LeasesService.updateRenewalStatus(req.params.id, companyId, req.body.status, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const listLeases = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const leases = await LeasesService.listLeases({
      companyId,
      status: req.query.status,
      expiringWithinDays: req.query.expiringWithinDays ? parseInt(req.query.expiringWithinDays as string, 10) : undefined,
    });
    return sendSuccess(res, leases, 200, { total: leases.length, page: 1, totalPages: 1 });
  } catch (err) {
    return next(err);
  }
};

export const getLease = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const lease = await LeasesService.getLeaseById(req.params.id, companyId);
    return sendSuccess(res, lease, 200);
  } catch (err) {
    return next(err);
  }
};

export const createLease = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const lease = await LeasesService.createLease(req.body, companyId, req.user?.userId);
    return sendSuccess(res, lease, 201);
  } catch (err) {
    return next(err);
  }
};

export const renewLease = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const renewal = await LeasesService.renewLease(req.params.id, companyId, req.body, req.user?.userId);
    return sendSuccess(res, renewal, 200);
  } catch (err) {
    return next(err);
  }
};

export const addMoveInspection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const inspection = await LeasesService.addMoveInspection(
      req.params.id,
      companyId,
      req.body,
      req.user?.userId
    );
    return sendSuccess(res, inspection, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateLease = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const lease = await LeasesService.updateLease(req.params.id, companyId, req.body, req.user?.userId);
    return sendSuccess(res, lease, 200);
  } catch (err) {
    return next(err);
  }
};

export const sendLeaseCredentials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const result = await LeasesService.sendLeaseCredentials(req.params.id, companyId, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteLease = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const result = await LeasesService.deleteLease(req.params.id, companyId, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

