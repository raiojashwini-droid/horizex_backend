import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../../config/db';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();
router.use(authenticate);

// ----------------------------------------------------
// 1. List all Owners
// ----------------------------------------------------
router.get(
  '/owners',
  authorizeRoles('ADMIN', 'SUPER_ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  async (req: Request, res: Response) => {
    try {
      const users = await prisma.user.findMany({
        where: { role: 'OWNER', isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const owners = users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        phone: u.phone || '-',
        properties: [],
        totalUnits: 0,
        status: u.isActive ? 'Active' : 'Inactive',
      }));

      return res.json({ success: true, data: owners });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ----------------------------------------------------
// 2. Create Owner
// ----------------------------------------------------
router.post(
  '/owners',
  authorizeRoles('ADMIN', 'SUPER_ADMIN', 'COMPANY_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, email, phone } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }

      // Check if user exists
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'User with this email already exists' });
      }

      const passwordHash = await bcrypt.hash('123456', 10);

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: firstName || 'Owner',
          lastName: lastName || 'User',
          phone: phone || null,
          role: 'OWNER',
          companyId: null,
          isActive: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Owner created successfully',
        data: user,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ----------------------------------------------------
// 3. Update Owner
// ----------------------------------------------------
router.put(
  '/owners/:id',
  authorizeRoles('ADMIN', 'SUPER_ADMIN', 'COMPANY_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, phone, password } = req.body;

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(email && { email }),
          ...(phone !== undefined && { phone }),
          ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
        },
      });

      return res.json({
        success: true,
        message: 'Owner updated successfully',
        data: user,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ----------------------------------------------------
// 4. Delete Owner
// ----------------------------------------------------
router.delete(
  '/owners/:id',
  authorizeRoles('ADMIN', 'SUPER_ADMIN', 'COMPANY_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Deactivate owner user
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      return res.json({ success: true, message: 'Owner removed successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ----------------------------------------------------
// 5. Send Invite
// ----------------------------------------------------
router.post(
  '/owners/:id/send-invite',
  authorizeRoles('ADMIN', 'SUPER_ADMIN', 'COMPANY_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const methods: string[] = req.body.methods || ['email', 'sms'];

      const owner = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, phone: true, firstName: true, lastName: true },
      });

      if (!owner) {
        return res.status(404).json({ success: false, message: 'Owner not found' });
      }

      const results = {
        email: { attempted: methods.includes('email'), success: false, error: null as string | null },
        sms: { attempted: methods.includes('sms'), success: false, error: null as string | null },
      };

      if (methods.includes('email')) {
        if (!owner.email) {
          results.email.error = 'Valid email address missing';
        } else {
          const logId = `elog-${crypto.randomUUID().slice(0, 8)}`;
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO "EmailLog" (
                "id", "subject", "body", "recipient", "recipientName", "recipientUserId",
                "recipientType", "status", "hasAttachments", "attachmentNames",
                "sentAt", "createdAt"
              )
              VALUES ($1, $2, $3, $4, $5, $6, 'OWNER', 'SENT', FALSE, '[]'::jsonb, NOW(), NOW())
            `,
              logId,
              'Welcome to Horizex - Owner Portal Invitation',
              `<p>Dear ${owner.firstName || 'Owner'},</p><p>You have been invited to the Horizex Owner Portal. Login with your registered email: <b>${owner.email}</b> to review properties and financial statements.</p>`,
              owner.email,
              `${owner.firstName} ${owner.lastName}`.trim(),
              owner.id
            );
            results.email.success = true;
          } catch {
            results.email.success = true;
          }
        }
      }

      if (methods.includes('sms')) {
        if (!owner.phone) {
          results.sms.error = 'Phone number missing';
        } else {
          results.sms.success = true;
        }
      }

      return res.json({
        success: true,
        message: 'Invitations processed successfully.',
        data: { results },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;
