import { Router } from 'express';
import {
  getQuickBooksOverview,
  saveQuickBooksCredentials,
  disconnectQuickBooks,
  triggerQuickBooksSync,
  getCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  triggerCalendarSync,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  getNotificationRules,
  toggleNotificationRule,
  getSyncQueue,
  retrySyncJob,
  cancelSyncJob,
  getAuditLogs,
} from './integrations.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// QuickBooks Integration
router.get('/quickbooks/overview', getQuickBooksOverview);
router.post(
  '/quickbooks/credentials',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTANT', 'ADMIN'),
  saveQuickBooksCredentials
);
router.post(
  '/quickbooks/disconnect',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTANT', 'ADMIN'),
  disconnectQuickBooks
);
router.post(
  '/quickbooks/sync',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER', 'ADMIN'),
  triggerQuickBooksSync
);

// Google Calendar Sync
router.get('/calendar/events', getCalendarEvents);
router.post('/calendar/events', createCalendarEvent);
router.delete('/calendar/events/:id', deleteCalendarEvent);
router.post('/calendar/sync', triggerCalendarSync);

// Notifications & Rules
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationRead);
router.post('/notifications/mark-all-read', markAllNotificationsRead);
router.put('/notifications/:id/dismiss', dismissNotification);
router.get('/notification-rules', getNotificationRules);
router.put('/notification-rules/:id', toggleNotificationRule);

// Sync Queue & Logs
router.get('/queue', getSyncQueue);
router.post('/queue/:id/retry', retrySyncJob);
router.post('/queue/:id/cancel', cancelSyncJob);
router.get('/logs', getAuditLogs);

export default router;
