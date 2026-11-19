import { Request, Response, NextFunction } from 'express';
import { IntegrationsService } from './integrations.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const getQuickBooksOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const data = await IntegrationsService.getQuickBooksOverview(companyId);
    return sendSuccess(res, data, 200);
  } catch (err) {
    return next(err);
  }
};

export const saveQuickBooksCredentials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.body.companyId as string) || (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const result = await IntegrationsService.saveQuickBooksCredentials(companyId, req.body, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const disconnectQuickBooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.body.companyId as string) || (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const result = await IntegrationsService.disconnectQuickBooks(companyId, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const triggerQuickBooksSync = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.body.companyId as string) || (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const { entityType, companyFile } = req.body;
    const result = await IntegrationsService.triggerQuickBooksSync(companyId, entityType, companyFile, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const getCalendarEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const events = await IntegrationsService.getCalendarEvents(companyId);
    return sendSuccess(res, events, 200);
  } catch (err) {
    return next(err);
  }
};

export const createCalendarEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.body.companyId as string) || (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const event = await IntegrationsService.createCalendarEvent(companyId, req.body, req.user?.userId);
    return sendSuccess(res, event, 201);
  } catch (err) {
    return next(err);
  }
};

export const deleteCalendarEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const result = await IntegrationsService.deleteCalendarEvent(companyId, req.params.id);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const triggerCalendarSync = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.body.companyId as string) || (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const result = await IntegrationsService.triggerCalendarSync(companyId, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const { priority, category } = req.query as { priority?: string; category?: string };
    const notifications = await IntegrationsService.getNotifications(companyId, { priority, category });
    return sendSuccess(res, notifications, 200);
  } catch (err) {
    return next(err);
  }
};

export const markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = IntegrationsService.markNotificationRead(req.params.id);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const result = IntegrationsService.markAllNotificationsRead(companyId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const dismissNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = IntegrationsService.dismissNotification(req.params.id);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const getNotificationRules = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const rules = await IntegrationsService.getNotificationRules(companyId);
    return sendSuccess(res, rules, 200);
  } catch (err) {
    return next(err);
  }
};

export const toggleNotificationRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.body.companyId as string) || (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const { isActive } = req.body;
    const rule = await IntegrationsService.toggleNotificationRule(companyId, req.params.id, !!isActive);
    return sendSuccess(res, rule, 200);
  } catch (err) {
    return next(err);
  }
};

export const getSyncQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const queue = await IntegrationsService.getSyncQueue(companyId);
    return sendSuccess(res, queue, 200);
  } catch (err) {
    return next(err);
  }
};

export const retrySyncJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await IntegrationsService.retrySyncJob(req.params.id, req.user?.userId);
    return sendSuccess(res, job, 200);
  } catch (err) {
    return next(err);
  }
};

export const cancelSyncJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await IntegrationsService.cancelSyncJob(req.params.id, req.user?.userId);
    return sendSuccess(res, job, 200);
  } catch (err) {
    return next(err);
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.query.companyId as string) || req.user?.effectiveCompanyId || req.user?.companyId;
    const logs = await IntegrationsService.getAuditLogs(companyId);
    return sendSuccess(res, logs, 200);
  } catch (err) {
    return next(err);
  }
};
