import { Request, Response, NextFunction } from 'express';
import { CommunicationsService } from './communications.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const getUnreadStats = async (req: Request, res: Response) => {
  return sendSuccess(res, { count: 0 });
};

export const getTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await CommunicationsService.getTemplates();
    return sendSuccess(res, templates);
  } catch (err) {
    return next(err);
  }
};

export const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await CommunicationsService.createTemplate(req.body);
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
    const isAdmin = req.user?.role === 'ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;

    const conversations = await CommunicationsService.listConversations(companyId);
    return sendSuccess(res, conversations, 200);
  } catch (err) {
    return next(err);
  }
};

export const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const history = await CommunicationsService.getHistory(userId);
    return sendSuccess(res, history);
  } catch (err) {
    return next(err);
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  return sendSuccess(res, { success: true });
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comm = await CommunicationsService.sendMessage(req.body, req.user?.userId);
    return sendSuccess(res, comm, 201);
  } catch (err) {
    return next(err);
  }
};

export const listCampaigns = async (req: Request, res: Response) => {
  return sendSuccess(res, []);
};

export const sendCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const companyId = isAdmin ? undefined : req.user?.effectiveCompanyId;

    const result = await CommunicationsService.sendCampaign(req.body, companyId, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteCampaign = async (req: Request, res: Response) => {
  return sendSuccess(res, { message: 'Campaign deleted' });
};

export const getCampaignFailures = async (req: Request, res: Response) => {
  return sendSuccess(res, []);
};

export const retryCampaign = async (req: Request, res: Response) => {
  return sendSuccess(res, { message: 'Campaign retried' });
};
