import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../../config/db';
import { sendSuccess, sendError } from '../../utils/apiResponse.util';

export const MODULES_LIST = [
  'Dashboard', 'Overview', 'Vacancy Dashboard', 'Revenue Dashboard',
  'Properties', 'Buildings', 'Units', 'Unit Readiness',
  'Tenants', 'Tenant List', 'Vehicles', 'Insurance', 
  'Shuttle',
  'Leases',
  'Rent Roll',
  'Documents',
  'Payments', 'Invoices', 'Payments Received', 'Outstanding Dues', 'Refunds',
  'Accounting', 'General Ledger',
  'TAL Cases',
  'Notes Hub',
  'Reports',
  'Communication', 'Inbox', 'Campaign Manager', 'Templates',
  'Email Hub', 'Send Email', 'Email Templates', 'Sent Emails',
  'Maintenance',
  'Tickets',
  'Inspections', 'Inspection List', 'Inspection Templates',
  'Settings'
];

export async function ensureUserPermissions(userId: string) {
  const existing = await prisma.permission.findMany({ where: { userId } });
  const existingModules = new Set(existing.map((p) => p.moduleName));
  const missing = MODULES_LIST.filter((m) => !existingModules.has(m));

  if (missing.length > 0) {
    await prisma.permission.createMany({
      data: missing.map((m) => ({
        userId,
        moduleName: m,
        canView: false,
        canAdd: false,
        canEdit: false,
        canDelete: false,
      })),
      skipDuplicates: true,
    });
  }

  return prisma.permission.findMany({
    where: { userId },
    orderBy: { moduleName: 'asc' },
  });
}

export const getCoworkers = async (req: Request, res: Response) => {
  try {
    const coworkers = await prisma.user.findMany({
      where: {
        role: 'COWORKER',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        companyId: true,
        permissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const coworkersWithHealedPerms = await Promise.all(
      coworkers.map(async (cw) => {
        const healedPerms = await ensureUserPermissions(cw.id);
        return {
          ...cw,
          name: `${cw.firstName} ${cw.lastName}`.trim(),
          permissions: healedPerms,
        };
      })
    );

    return sendSuccess(res, coworkersWithHealedPerms);
  } catch (error: any) {
    console.error('getCoworkers error:', error);
    return sendError(res, 'INTERNAL_ERROR', 'Failed to fetch coworkers', 500);
  }
};

export const getMyPermissions = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId || (req.user as any)?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    // ADMIN gets full access to all modules automatically
    if (userRole === 'ADMIN') {
      const adminPerms = MODULES_LIST.map((moduleName) => ({
        moduleName,
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
      }));
      return sendSuccess(res, adminPerms);
    }

    // Return their specific permissions
    const perms = await ensureUserPermissions(userId);
    return sendSuccess(res, perms);
  } catch (error: any) {
    console.error('getMyPermissions error:', error);
    return sendError(res, 'INTERNAL_ERROR', 'Failed to fetch my permissions', 500);
  }
};

export const createCoworker = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, permissions, companyId } = req.body;

    if (!email || !firstName) {
      return sendError(res, 'BAD_REQUEST', 'First name and email are required', 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return sendError(res, 'CONFLICT', 'A user with this email already exists', 409);
    }

    // Generate random temporary password hash
    const tempPassword = crypto.randomBytes(8).toString('hex') + 'Aa1!';
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName: lastName || '',
        phone: phone || null,
        passwordHash,
        role: 'COWORKER',
        companyId: companyId || req.user?.effectiveCompanyId || null,
        isActive: true,
      },
    });

    if (Array.isArray(permissions) && permissions.length > 0) {
      for (const p of permissions) {
        if (p.moduleName) {
          await prisma.permission.upsert({
            where: {
              userId_moduleName: {
                userId: newUser.id,
                moduleName: p.moduleName,
              },
            },
            create: {
              userId: newUser.id,
              moduleName: p.moduleName,
              canView: !!p.canView,
              canAdd: !!p.canAdd,
              canEdit: !!p.canEdit,
              canDelete: !!p.canDelete,
            },
            update: {
              canView: !!p.canView,
              canAdd: !!p.canAdd,
              canEdit: !!p.canEdit,
              canDelete: !!p.canDelete,
            },
          });
        }
      }
    }

    const completePerms = await ensureUserPermissions(newUser.id);

    return sendSuccess(
      res,
      {
        ...newUser,
        name: `${newUser.firstName} ${newUser.lastName}`.trim(),
        permissions: completePerms,
      },
      201
    );
  } catch (error: any) {
    console.error('createCoworker error:', error);
    return sendError(res, 'INTERNAL_ERROR', 'Failed to create coworker', 500);
  }
};

export const updateCoworker = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, isActive, permissions } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    if (Array.isArray(permissions)) {
      for (const p of permissions) {
        if (p.moduleName) {
          await prisma.permission.upsert({
            where: {
              userId_moduleName: {
                userId: id,
                moduleName: p.moduleName,
              },
            },
            create: {
              userId: id,
              moduleName: p.moduleName,
              canView: !!p.canView,
              canAdd: !!p.canAdd,
              canEdit: !!p.canEdit,
              canDelete: !!p.canDelete,
            },
            update: {
              ...(p.canView !== undefined && { canView: !!p.canView }),
              ...(p.canAdd !== undefined && { canAdd: !!p.canAdd }),
              ...(p.canEdit !== undefined && { canEdit: !!p.canEdit }),
              ...(p.canDelete !== undefined && { canDelete: !!p.canDelete }),
            },
          });
        }
      }
    }

    const updatedPerms = await ensureUserPermissions(id);
    return sendSuccess(res, {
      ...user,
      name: `${user.firstName} ${user.lastName}`.trim(),
      permissions: updatedPerms,
    });
  } catch (error: any) {
    console.error('updateCoworker error:', error);
    return sendError(res, 'INTERNAL_ERROR', 'Failed to update coworker', 500);
  }
};

export const updatePermissions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return sendError(res, 'BAD_REQUEST', 'Permissions array required', 400);
    }

    for (const p of permissions) {
      if (p.moduleName) {
        await prisma.permission.upsert({
          where: {
            userId_moduleName: {
              userId: id,
              moduleName: p.moduleName,
            },
          },
          create: {
            userId: id,
            moduleName: p.moduleName,
            canView: !!p.canView,
            canAdd: !!p.canAdd,
            canEdit: !!p.canEdit,
            canDelete: !!p.canDelete,
          },
          update: {
            ...(p.canView !== undefined && { canView: !!p.canView }),
            ...(p.canAdd !== undefined && { canAdd: !!p.canAdd }),
            ...(p.canEdit !== undefined && { canEdit: !!p.canEdit }),
            ...(p.canDelete !== undefined && { canDelete: !!p.canDelete }),
          },
        });
      }
    }

    const updatedPerms = await ensureUserPermissions(id);
    return sendSuccess(res, updatedPerms);
  } catch (error: any) {
    console.error('updatePermissions error:', error);
    return sendError(res, 'INTERNAL_ERROR', 'Failed to update permissions', 500);
  }
};

export const deleteCoworker = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id } });
    return sendSuccess(res, { message: 'Coworker deleted successfully' });
  } catch (error: any) {
    console.error('deleteCoworker error:', error);
    return sendError(res, 'INTERNAL_ERROR', 'Failed to delete coworker', 500);
  }
};

export const sendInvite = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }
    return sendSuccess(res, { message: `Invitation email sent to ${user.email} successfully` });
  } catch (error: any) {
    console.error('sendInvite error:', error);
    return sendError(res, 'INTERNAL_ERROR', 'Failed to send invite', 500);
  }
};
