import { Request, Response, NextFunction } from 'express';
import { MaintenanceService } from './maintenance.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const listTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const effectiveCompanyId = (req.query.companyId as string) || req.user?.effectiveCompanyId;
    const companyId = isSuperAdmin ? ((req.query.companyId as string) || undefined) : effectiveCompanyId;

    const tickets = await MaintenanceService.listTickets({
      companyId,
      propertyId: req.query.propertyId as string | undefined,
      priority: req.query.priority,
      status: req.query.status,
    });
    return sendSuccess(res, tickets, 200);
  } catch (err) {
    return next(err);
  }
};

export const getTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const effectiveCompanyId = (req.query.companyId as string) || req.user?.effectiveCompanyId;
    const companyId = isSuperAdmin ? ((req.query.companyId as string) || undefined) : effectiveCompanyId;

    const ticket = await MaintenanceService.getTicketById(req.params.id, companyId);
    return sendSuccess(res, ticket, 200);
  } catch (err) {
    return next(err);
  }
};

export const createTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const effectiveCompanyId = req.body.companyId || (req.query.companyId as string) || req.user?.effectiveCompanyId;
    const companyId = isSuperAdmin ? (req.body.companyId || undefined) : effectiveCompanyId;

    const ticket = await MaintenanceService.createTicket(req.body, companyId, req.user?.userId);
    return sendSuccess(res, ticket, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateTicketStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const updated = await MaintenanceService.updateTicketStatus(
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

export const assignTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const updated = await MaintenanceService.assignTicket(
      req.params.id,
      companyId,
      req.body.staffProfileId,
      req.user?.userId
    );
    return sendSuccess(res, updated, 200);
  } catch (err) {
    return next(err);
  }
};

export const updateTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const updated = await MaintenanceService.updateTicket(
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

export const deleteTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const result = await MaintenanceService.deleteTicket(
      req.params.id,
      companyId,
      req.user?.userId
    );
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};
