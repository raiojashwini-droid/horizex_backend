import { Request, Response, NextFunction } from 'express';
import { CommunicationsService } from './communications.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const getUnreadStats = async (req: Request, res: Response) => {
  return sendSuccess(res, { count: 0 });
};

export const getTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;
    const templates = await CommunicationsService.getTemplates(companyId);
    return sendSuccess(res, templates);
  } catch (err) {
    return next(err);
  }
};

export const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;
    const template = await CommunicationsService.createTemplate({
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
    const template = await CommunicationsService.updateTemplate(id, req.body);
    return sendSuccess(res, template);
  } catch (err) {
    return next(err);
  }
};

export const deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await CommunicationsService.deleteTemplate(id);
    return sendSuccess(res, { message: 'Template deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

export const listConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;

    const conversations = await CommunicationsService.listConversations(
      companyId,
      req.user?.userId,
      req.user?.role
    );
    return sendSuccess(res, conversations, 200);
  } catch (err) {
    return next(err);
  }
};

export const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const history = await CommunicationsService.getHistory(
      userId,
      req.user?.userId,
      req.user?.role
    );
    return sendSuccess(res, history);
  } catch (err) {
    return next(err);
  }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CommunicationsService.markAsRead(req.body?.senderId);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comm = await CommunicationsService.sendMessage(req.body, req.user?.userId);
    return sendSuccess(res, comm, 201);
  } catch (err) {
    return next(err);
  }
};

export const listCampaigns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;
    const campaigns = await CommunicationsService.listCampaigns(companyId);
    return sendSuccess(res, campaigns);
  } catch (err) {
    return next(err);
  }
};

export const sendCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;

    const result = await CommunicationsService.sendCampaign(req.body, companyId, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await CommunicationsService.deleteCampaign(id);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

export const getCampaignFailures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await CommunicationsService.getCampaignFailures(id);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

export const retryCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await CommunicationsService.retryCampaign(id);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};
