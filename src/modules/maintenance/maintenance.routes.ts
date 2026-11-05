import { Router } from 'express';
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicketStatus,
  assignTicket,
  updateTicket,
  deleteTicket,
} from './maintenance.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  createTicketSchema,
  updateTicketStatusSchema,
  assignTicketSchema,
  updateTicketSchema,
} from './maintenance.schema';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';
import { prisma } from '../../config/db';
import { sendSuccess } from '../../utils/apiResponse.util';

const router = Router();

// Public Tenant Repair Request endpoints (accessible via copied tenant link)
router.post(
  '/public-request',
  validateRequest(createTicketSchema),
  createTicket
);

router.get('/public-properties', async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        address: true,
        units: { select: { id: true, unitNumber: true } },
      },
    });
    return sendSuccess(res, properties, 200);
  } catch (e) {
    return next(e);
  }
});

// All subsequent routes require authentication
router.use(authenticate);

router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'TENANT', 'OWNER'),
  listTickets
);

router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'TENANT'),
  validateRequest(createTicketSchema),
  createTicket
);

router.get(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'TENANT', 'OWNER'),
  getTicket
);

router.put(
  '/:id/status',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'),
  validateRequest(updateTicketStatusSchema),
  updateTicketStatus
);

router.put(
  '/:id/assign',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  validateRequest(assignTicketSchema),
  assignTicket
);

router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'),
  validateRequest(updateTicketSchema),
  updateTicket
);

router.delete(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  deleteTicket
);

export default router;
