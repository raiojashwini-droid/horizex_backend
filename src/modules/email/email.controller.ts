import { Request, Response, NextFunction } from 'express';
import { EmailService } from './email.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const getTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;
    const templates = await EmailService.getTemplates(companyId);
    return sendSuccess(res, templates);
  } catch (err) {
    return next(err);
  }
};

export const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;
    const template = await EmailService.createTemplate({
      ...req.body,
      companyId: req.body.companyId || companyId,
    });
    return sendSuccess(res, template, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const template = await EmailService.updateTemplate(id, req.body);
    return sendSuccess(res, template);
  } catch (err) {
    return next(err);
  }
};

export const deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await EmailService.deleteTemplate(id);
    return sendSuccess(res, { message: 'Email template deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

export const getSignature = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sig = await EmailService.getSignature(req.user?.userId);
    return sendSuccess(res, sig);
  } catch (err) {
    return next(err);
  }
};

export const sendBulk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;
    const result = await EmailService.sendBulk(req.body, companyId, req.user?.userId);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

export const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;
    const history = await EmailService.getHistory({
      ...req.query,
      companyId,
    });
    return sendSuccess(res, history);
  } catch (err) {
    return next(err);
  }
};

export const getLogById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const log = await EmailService.getLogById(id);
    return sendSuccess(res, log);
  } catch (err) {
    return next(err);
  }
};

export const resendEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await EmailService.resendEmail(id, req.user?.userId);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

