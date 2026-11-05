import { Request, Response, NextFunction } from 'express';
import { UnitsService } from './units.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const listUnits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const units = await UnitsService.listUnits({
      companyId,
      propertyId: req.query.propertyId as string | undefined,
      status: req.query.status,
      showInactive: req.query.showInactive !== undefined ? req.query.showInactive === 'true' : undefined,
      bedrooms: req.query.bedrooms ? parseInt(req.query.bedrooms as string, 10) : undefined,
      minRent: req.query.minRent ? parseFloat(req.query.minRent as string) : undefined,
      maxRent: req.query.maxRent ? parseFloat(req.query.maxRent as string) : undefined,
    });

    return sendSuccess(res, units, 200);
  } catch (err) {
    return next(err);
  }
};

export const getVacantBedrooms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unitId = (req.query.unitId || req.query.unit_id) as string | undefined;
    const includeId = req.query.includeId as string | undefined;
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const bedrooms = await UnitsService.getVacantBedrooms(unitId, companyId, includeId);
    return sendSuccess(res, bedrooms, 200);
  } catch (err) {
    return next(err);
  }
};

export const getUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const unit = await UnitsService.getUnitById(req.params.id, companyId);
    return sendSuccess(res, unit, 200);
  } catch (err) {
    return next(err);
  }
};

export const createUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const unit = await UnitsService.createUnit(req.body, companyId, req.user?.userId);
    return sendSuccess(res, unit, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const updated = await UnitsService.updateUnit(req.params.id, companyId, req.body, req.user?.userId);
    return sendSuccess(res, updated, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const result = await UnitsService.deleteUnit(req.params.id, companyId, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};


export const getReadinessDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const dashboard = await UnitsService.getReadinessDashboard(companyId);
    return sendSuccess(res, dashboard, 200);
  } catch (err) {
    return next(err);
  }
};

export const getReadinessBuildings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const buildings = await UnitsService.getReadinessBuildings(companyId);
    return sendSuccess(res, buildings, 200);
  } catch (err) {
    return next(err);
  }
};

export const getReadinessStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const stats = await UnitsService.getReadinessStats(companyId);
    return sendSuccess(res, stats, 200);
  } catch (err) {
    return next(err);
  }
};

export const updateUnitReadiness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const updated = await UnitsService.updateUnitReadiness(
      req.params.id,
      companyId,
      req.body,
      req.user?.userId
    );
    return sendSuccess(res, updated, 200);
  } catch (err) {
    return next(err);
  }
};


