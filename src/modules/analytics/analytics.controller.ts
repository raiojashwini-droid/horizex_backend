import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const stats = await AnalyticsService.getDashboardStats(companyId);
    return sendSuccess(res, stats, 200);
  } catch (err) {
    return next(err);
  }
};

export const getRevenueTrajectory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const trajectory = await AnalyticsService.getRevenueTrajectory(companyId);
    return sendSuccess(res, trajectory, 200);
  } catch (err) {
    return next(err);
  }
};

export const getVacancyAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const analytics = await AnalyticsService.getVacancyAnalytics(companyId);
    return sendSuccess(res, analytics, 200);
  } catch (err) {
    return next(err);
  }
};

