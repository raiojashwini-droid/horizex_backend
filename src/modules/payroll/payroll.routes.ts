import { Router } from 'express';
import {
  listShifts,
  getShift,
  createShift,
  updateShift,
  deleteShift,
  listLeaves,
  getLeave,
  createLeave,
  updateLeaveStatus,
  deleteLeave,
  listOvertime,
  getOvertime,
  createOvertime,
  updateOvertimeStatus,
  deleteOvertime,
  listPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  generatePayrollRuns,
  approvePayrollRun,
  rejectPayrollRun,
  markPaidPayrollRun,
  uploadPayrollRunReceipt,
} from './payroll.controller';
import { authenticate } from '../../middlewares/auth.middleware';

export const shiftsRouter = Router();
shiftsRouter.use(authenticate);
shiftsRouter.get('/', listShifts);
shiftsRouter.get('/:id', getShift);
shiftsRouter.post('/', createShift);
shiftsRouter.put('/:id', updateShift);
shiftsRouter.delete('/:id', deleteShift);

export const leavesRouter = Router();
leavesRouter.use(authenticate);
leavesRouter.get('/', listLeaves);
leavesRouter.get('/:id', getLeave);
leavesRouter.post('/', createLeave);
leavesRouter.put('/:id', updateLeaveStatus);
leavesRouter.patch('/:id/status', updateLeaveStatus);
leavesRouter.delete('/:id', deleteLeave);

export const overtimeRouter = Router();
overtimeRouter.use(authenticate);
overtimeRouter.get('/', listOvertime);
overtimeRouter.get('/:id', getOvertime);
overtimeRouter.post('/', createOvertime);
overtimeRouter.put('/:id', updateOvertimeStatus);
overtimeRouter.patch('/:id/status', updateOvertimeStatus);
overtimeRouter.delete('/:id', deleteOvertime);

export const runsRouter = Router();
runsRouter.use(authenticate);
runsRouter.get('/', listPayrollRuns);
runsRouter.get('/:id', getPayrollRun);
runsRouter.post('/', createPayrollRun);
runsRouter.post('/generate', generatePayrollRuns);
runsRouter.patch('/:id/approve', approvePayrollRun);
runsRouter.patch('/:id/reject', rejectPayrollRun);
runsRouter.patch('/:id/pay', markPaidPayrollRun);
runsRouter.post('/:id/receipt', uploadPayrollRunReceipt);

const payrollRouter = Router();
payrollRouter.use('/shifts', shiftsRouter);
payrollRouter.use('/leaves', leavesRouter);
payrollRouter.use('/overtime', overtimeRouter);
payrollRouter.use('/runs', runsRouter);

export default payrollRouter;
