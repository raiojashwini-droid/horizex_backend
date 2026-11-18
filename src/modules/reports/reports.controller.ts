import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const getCustomReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId =
      (req.query.companyId as string) ||
      (req.body?.companyId as string) ||
      req.user?.effectiveCompanyId ||
      (req.headers['x-company-context'] as string);

    const buildingId =
      (req.query.buildingId as string) ||
      (req.body?.buildingId as string) ||
      (req.query.propertyId as string);

    const module = (req.query.module as any) || (req.body?.module as any) || 'Financials';
    const search = (req.query.search as string) || (req.body?.search as string) || null;
    const sortColumn = (req.query.sortColumn as string) || (req.body?.sortColumn as string) || null;
    const sortDirection = (req.query.sortDirection as any) || (req.body?.sortDirection as any) || 'asc';

    const result = await ReportsService.executeCustomReportQuery({
      module,
      companyId: companyId && companyId !== 'all' ? companyId : null,
      buildingId: buildingId && buildingId !== 'all' ? buildingId : null,
      search,
      sortColumn,
      sortDirection,
    });

    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

export const getReportTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const module = req.query.module as string | undefined;
    const templates = await ReportsService.getTemplates(module);
    return sendSuccess(res, templates);
  } catch (err) {
    return next(err);
  }
};

export const saveReportTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const saved = await ReportsService.saveTemplate(req.body, req.user?.userId);
    return sendSuccess(res, saved, 201);
  } catch (err) {
    return next(err);
  }
};

export const deleteReportTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const result = await ReportsService.deleteTemplate(id);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

export const logReportAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reportType, filtersUsed, exportType } = req.body;
    const log = await ReportsService.logAudit(reportType, filtersUsed, exportType, req.user?.userId);
    return sendSuccess(res, log, 201);
  } catch (err) {
    return next(err);
  }
};

export const getReportAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await ReportsService.getAuditLogs(limit);
    return sendSuccess(res, logs);
  } catch (err) {
    return next(err);
  }
};
