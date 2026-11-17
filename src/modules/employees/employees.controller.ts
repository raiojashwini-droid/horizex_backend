import { Request, Response, NextFunction } from 'express';
import { EmployeesService } from './employees.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const listEmployees = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    const queryCompanyId = (req.query.companyId as string) || (req.headers['x-company-context'] as string);
    const companyId = queryCompanyId && queryCompanyId !== 'all' ? queryCompanyId : (isSuperAdmin ? undefined : req.user?.effectiveCompanyId);

    const filters = {
      ...req.query,
      companyId: companyId && companyId !== 'all' ? companyId : undefined,
    };
    const employees = await EmployeesService.listEmployees(filters);
    return sendSuccess(res, employees, 200);
  } catch (err) {
    return next(err);
  }
};

export const getEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employee = await EmployeesService.getEmployeeById(req.params.id);
    return sendSuccess(res, employee, 200);
  } catch (err) {
    return next(err);
  }
};

export const createEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employee = await EmployeesService.createEmployee(
      {
        ...req.body,
        companyId: req.body.companyId || req.user?.effectiveCompanyId,
      },
      req.user?.userId
    );
    return sendSuccess(res, employee, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await EmployeesService.updateEmployee(
      req.params.id,
      req.body,
      req.user?.userId
    );
    return sendSuccess(res, updated, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await EmployeesService.deleteEmployee(req.params.id, req.user?.userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

