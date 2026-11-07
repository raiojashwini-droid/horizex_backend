import { Router } from 'express';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getSignature,
  sendBulk,
  getHistory,
  getLogById,
  resendEmail,
} from './email.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// 1. Email Templates
router.get('/templates', getTemplates);
router.post('/templates', authorizeRoles('ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), createTemplate);
router.put('/templates/:id', authorizeRoles('ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), updateTemplate);
router.delete('/templates/:id', authorizeRoles('ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), deleteTemplate);

// 2. Admin Signature
router.get('/signature', getSignature);

// 3. Bulk Sender (Composer)
router.post('/send-bulk', authorizeRoles('ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), sendBulk);

// 4. Sent Emails History & Resend
router.get('/history', getHistory);
router.get('/history/:id', getLogById);
router.post('/history/:id/resend', authorizeRoles('ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), resendEmail);

export default router;

