import { Request, Response, NextFunction } from 'express';
import { TalCasesService } from './talCases.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const listCases = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const cases = await TalCasesService.listCases(companyId);
    return sendSuccess(res, cases, 200);
  } catch (err) {
    return next(err);
  }
};

export const getCase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const talCase = await TalCasesService.getCaseById(req.params.id, companyId);
    return sendSuccess(res, talCase, 200);
  } catch (err) {
    return next(err);
  }
};

export const createCase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const talCase = await TalCasesService.createCase(req.body, companyId, req.user?.userId);
    return sendSuccess(res, talCase, 201);
  } catch (err) {
    return next(err);
  }
};

export const scheduleHearing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const event = await TalCasesService.scheduleHearing(
      req.params.id,
      companyId,
      req.body,
      req.user?.userId
    );
    return sendSuccess(res, event, 201);
  } catch (err) {
    return next(err);
  }
};

