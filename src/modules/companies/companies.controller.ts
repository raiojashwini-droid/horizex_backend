import { Request, Response, NextFunction } from 'express';
import { CompaniesService } from './companies.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const listCompanies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const companies = await CompaniesService.listCompanies(req.user?.effectiveCompanyId, isSuperAdmin);
    return sendSuccess(res, companies, 200);
  } catch (err) {
    return next(err);
  }
};

export const getCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await CompaniesService.getCompanyById(req.params.id);
    return sendSuccess(res, company, 200);
  } catch (err) {
    return next(err);
  }
};

export const createCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await CompaniesService.createCompany(req.body, req.user?.userId);
    return sendSuccess(res, company, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await CompaniesService.updateCompany(req.params.id, req.body, req.user?.userId);
    return sendSuccess(res, updated, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CompaniesService.softDeleteCompany(req.params.id, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

