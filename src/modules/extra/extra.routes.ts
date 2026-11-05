import { Router } from 'express';
import {
  listUnitTypes,
  createUnitType,
  updateUnitType,
  deleteUnitType,
  listInsurance,
  createInsurance,
  listNotes,
  createNote,
  getNote,
  updateNote,
  deleteNote,
  listClockLogs,
  clockIn,
  clockOut,
  getSettings,
  saveSettings,
} from './extra.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Unit Types
router.get('/unit-types', listUnitTypes);
router.post('/unit-types', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), createUnitType);
router.put('/unit-types/:id', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), updateUnitType);
router.delete('/unit-types/:id', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), deleteUnitType);

// Insurance Policies
router.get('/insurance', listInsurance);
router.post('/insurance', authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), createInsurance);

// Notes Hub
router.get('/notes', listNotes);
router.post('/notes', createNote);
router.get('/notes/:id', getNote);
router.put('/notes/:id', updateNote);
router.delete('/notes/:id', deleteNote);

// Clock Logs & Timesheet
router.get('/clock-logs', listClockLogs);
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);

// System Settings
router.get('/settings', getSettings);
router.post('/settings', saveSettings);

export default router;

