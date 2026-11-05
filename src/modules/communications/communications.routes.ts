import { Router } from 'express';
import {
  getUnreadStats,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listConversations,
  getHistory,
  markAsRead,
  sendMessage,
  listCampaigns,
  sendCampaign,
  deleteCampaign,
  getCampaignFailures,
  retryCampaign,
} from './communications.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// 1. Unread stats (for Topbar & Sidebar badges)
router.get('/unread-stats', getUnreadStats);

// 2. SMS / Communication Templates
router.get('/templates', getTemplates);
router.post('/templates', authorizeRoles('ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), createTemplate);
router.put('/templates/:id', authorizeRoles('ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), updateTemplate);
router.delete('/templates/:id', authorizeRoles('ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'), deleteTemplate);

// 3. Conversations & Messages
router.get('/conversations', listConversations);
router.get('/history/:userId', getHistory);
router.post('/mark-read', markAsRead);
router.post('/send', sendMessage);

// 4. Campaigns
router.get('/campaigns', listCampaigns);
router.post('/campaign', sendCampaign);
router.post('/campaigns', sendCampaign);
router.delete('/campaign/:id', deleteCampaign);
router.get('/campaign/:id/failures', getCampaignFailures);
router.post('/campaign/:id/retry', retryCampaign);

export default router;
