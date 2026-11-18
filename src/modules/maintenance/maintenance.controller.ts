import { Request, Response, NextFunction } from 'express';
import { MaintenanceService } from './maintenance.service';
import { sendSuccess } from '../../utils/apiResponse.util';

function resolveCompanyId(req: Request): string | undefined {
  const reqComp = (req.query.companyId as string) || (req.headers['x-company-context'] as string) || req.user?.effectiveCompanyId;
  if (reqComp && reqComp !== 'all' && reqComp !== 'null' && reqComp !== 'undefined') {
    return reqComp;
  }
  const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
  return isAdmin ? undefined : (req.user?.companyId || undefined);
}

export const listTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req);
    const rawProp = req.query.propertyId as string | undefined;
    const propertyId = rawProp && rawProp !== 'all' && rawProp !== 'null' && rawProp !== 'undefined' ? rawProp : undefined;

    const tickets = await MaintenanceService.listTickets({
      companyId,
      propertyId,
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
    const companyId = resolveCompanyId(req);

    const ticket = await MaintenanceService.getTicketById(req.params.id, companyId);
    return sendSuccess(res, ticket, 200);
  } catch (err) {
    return next(err);
  }
};

export const createTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req) || req.body.companyId;

    const ticket = await MaintenanceService.createTicket(req.body, companyId, req.user?.userId);
    return sendSuccess(res, ticket, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateTicketStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req);

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
    const companyId = resolveCompanyId(req);

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
    const companyId = resolveCompanyId(req);

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
    const companyId = resolveCompanyId(req);

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
