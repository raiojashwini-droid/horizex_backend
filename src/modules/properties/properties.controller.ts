import { Request, Response, NextFunction } from 'express';
import { PropertiesService } from './properties.service';
import { sendSuccess } from '../../utils/apiResponse.util';
import { AppError } from '../../middlewares/errorHandler';
import { prisma } from '../../config/db';

export const listProperties = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const effectiveCompanyId = (req.query.companyId as string) || (req.user?.effectiveCompanyId || undefined);
    const search = req.query.search as string | undefined;

    const properties = await PropertiesService.listProperties(effectiveCompanyId, search);
    return sendSuccess(res, properties, 200);
  } catch (err) {
    return next(err);
  }
};

export const getProperty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const property = await PropertiesService.getPropertyById(req.params.id, companyId);
    return sendSuccess(res, property, 200);
  } catch (err) {
    return next(err);
  }
};

export const createProperty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let effectiveCompanyId = req.body.companyId || req.user?.effectiveCompanyId || req.user?.companyId;
    if (!effectiveCompanyId) {
      const defaultCompany = await prisma.company.findFirst();
      effectiveCompanyId = defaultCompany?.id;
    }

    if (!effectiveCompanyId) {
      throw new AppError('companyId is required to associate property', 400, 'COMPANY_ID_REQUIRED');
    }

    const property = await PropertiesService.createProperty(
      {
        ...req.body,
        companyId: effectiveCompanyId,
      },
      req.user?.userId
    );

    return sendSuccess(res, property, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateProperty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const updated = await PropertiesService.updateProperty(
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

export const deleteProperty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const result = await PropertiesService.softDeleteProperty(req.params.id, companyId, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

