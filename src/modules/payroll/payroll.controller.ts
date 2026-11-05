import { Request, Response, NextFunction } from 'express';
import { PayrollService } from './payroll.service';
import { sendSuccess } from '../../utils/apiResponse.util';

// -------------------------------------------------------------
// SHIFT CONTROLLERS
// -------------------------------------------------------------
export const listShifts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shifts = await PayrollService.listShifts();
    return sendSuccess(res, shifts, 200);
  } catch (err) {
    return next(err);
  }
};

export const getShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shift = await PayrollService.getShiftById(req.params.id);
    return sendSuccess(res, shift, 200);
  } catch (err) {
    return next(err);
  }
};

export const createShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shift = await PayrollService.createShift(req.body);
    return sendSuccess(res, shift, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shift = await PayrollService.updateShift(req.params.id, req.body);
    return sendSuccess(res, shift, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await PayrollService.deleteShift(req.params.id);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

// -------------------------------------------------------------
// LEAVE CONTROLLERS
// -------------------------------------------------------------
export const listLeaves = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leaves = await PayrollService.listLeaves(req.query);
    return sendSuccess(res, leaves, 200);
  } catch (err) {
    return next(err);
  }
};

export const getLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leave = await PayrollService.getLeaveById(req.params.id);
    return sendSuccess(res, leave, 200);
  } catch (err) {
    return next(err);
  }
};

export const createLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorName = req.user?.email || 'Admin User';
    const leave = await PayrollService.createLeave(req.body, authorName);
    return sendSuccess(res, leave, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateLeaveStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reason, rejectionReason } = req.body;
    const leave = await PayrollService.updateLeaveStatus(req.params.id, status, reason || rejectionReason);
    return sendSuccess(res, leave, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await PayrollService.deleteLeave(req.params.id);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

// -------------------------------------------------------------
// OVERTIME CONTROLLERS
// -------------------------------------------------------------
export const listOvertime = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await PayrollService.listOvertime(req.query);
    return sendSuccess(res, logs, 200);
  } catch (err) {
    return next(err);
  }
};

export const getOvertime = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const log = await PayrollService.getOvertimeById(req.params.id);
    return sendSuccess(res, log, 200);
  } catch (err) {
    return next(err);
  }
};

export const createOvertime = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorName = req.user?.email || 'Admin User';
    const log = await PayrollService.createOvertime(req.body, authorName);
    return sendSuccess(res, log, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateOvertimeStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, paidStatus } = req.body;
    const log = await PayrollService.updateOvertimeStatus(req.params.id, status, paidStatus);
    return sendSuccess(res, log, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteOvertime = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await PayrollService.deleteOvertime(req.params.id);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

// -------------------------------------------------------------
// PAYROLL RUN CONTROLLERS
// -------------------------------------------------------------
export const listPayrollRuns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runs = await PayrollService.listPayrollRuns(req.query);
    return sendSuccess(res, runs, 200);
  } catch (err) {
    return next(err);
  }
};

export const getPayrollRun = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const run = await PayrollService.getPayrollRunById(req.params.id);
    return sendSuccess(res, run, 200);
  } catch (err) {
    return next(err);
  }
};

export const createPayrollRun = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorName = req.user?.email || 'Admin User';
    const run = await PayrollService.createPayrollRun(req.body, authorName);
    return sendSuccess(res, run, 201);
  } catch (err) {
    return next(err);
  }
};

export const generatePayrollRuns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorName = req.user?.email || 'Admin User';
    const runs = await PayrollService.generatePayrollRuns(req.body, authorName);
    return sendSuccess(res, runs, 201);
  } catch (err) {
    return next(err);
  }
};

export const approvePayrollRun = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { level } = req.body;
    const approverName = req.user?.email || 'Admin User';
    const run = await PayrollService.approvePayrollRun(req.params.id, level, approverName);
    return sendSuccess(res, run, 200);
  } catch (err) {
    return next(err);
  }
};

export const rejectPayrollRun = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const rejecterName = req.user?.email || 'Admin User';
    const run = await PayrollService.rejectPayrollRun(req.params.id, reason, rejecterName);
    return sendSuccess(res, run, 200);
  } catch (err) {
    return next(err);
  }
};

export const markPaidPayrollRun = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payerName = req.user?.email || 'Admin User';
    const run = await PayrollService.markPaidPayrollRun(req.params.id, payerName);
    return sendSuccess(res, run, 200);
  } catch (err) {
    return next(err);
  }
};

export const uploadPayrollRunReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { receiptFile } = req.body;
    const run = await PayrollService.uploadPayrollRunReceipt(req.params.id, receiptFile);
    return sendSuccess(res, run, 200);
  } catch (err) {
    return next(err);
  }
};
