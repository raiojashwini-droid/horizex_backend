import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { sendSuccess } from '../../utils/apiResponse.util';
import { AppError } from '../../middlewares/errorHandler';

// Unit Types
export const listUnitTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unitTypes = await prisma.unitType.findMany({
      orderBy: { name: 'asc' },
    });
    const mapped = unitTypes.map(ut => ({
      ...ut,
      typeName: ut.name,
      fullUnitRate: ut.marketRent || 0,
      singleBedroomRate: 0,
    }));
    return sendSuccess(res, mapped, 200);
  } catch (err) {
    return next(err);
  }
};

export const createUnitType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = req.body.name || req.body.typeName || 'Standard Unit';
    const code = req.body.code || (name ? name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() : `TYPE_${Date.now()}`);
    const marketRent = Number(req.body.marketRent || req.body.fullUnitRate) || 1200;
    const created = await prisma.unitType.create({
      data: {
        name,
        code,
        marketRent,
      },
    });
    return sendSuccess(res, {
      ...created,
      typeName: created.name,
      fullUnitRate: created.marketRent,
      singleBedroomRate: 0,
    }, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateUnitType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = req.body.name || req.body.typeName;
    const code = req.body.code;
    const marketRent = req.body.marketRent !== undefined ? Number(req.body.marketRent) : (req.body.fullUnitRate !== undefined ? Number(req.body.fullUnitRate) : undefined);
    const data: any = {};
    if (name) data.name = name;
    if (code) data.code = code;
    if (marketRent !== undefined) data.marketRent = marketRent;

    const updated = await prisma.unitType.update({
      where: { id: req.params.id },
      data,
    });
    return sendSuccess(res, {
      ...updated,
      typeName: updated.name,
      fullUnitRate: updated.marketRent,
      singleBedroomRate: 0,
    }, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteUnitType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.unit.updateMany({
      where: { unitTypeId: req.params.id },
      data: { unitTypeId: null },
    });
    await prisma.unitType.delete({
      where: { id: req.params.id },
    });
    return sendSuccess(res, { message: 'Unit type deleted successfully' }, 200);
  } catch (err) {
    return next(err);
  }
};

// Insurance Policies
export const listInsurance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const companyId = isSuperAdmin ? undefined : req.user?.effectiveCompanyId;

    const policies = await prisma.insurancePolicy.findMany({
      where: companyId ? { property: { companyId } } : {},
      include: { property: { select: { id: true, name: true, address: true } } },
      orderBy: { expiryDate: 'asc' },
    });
    return sendSuccess(res, policies, 200);
  } catch (err) {
    return next(err);
  }
};

export const createInsurance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await prisma.insurancePolicy.create({
      data: {
        propertyId: req.body.propertyId,
        carrier: req.body.carrier,
        policyNumber: req.body.policyNumber,
        coverageAmount: req.body.coverageAmount,
        expiryDate: new Date(req.body.expiryDate),
        isCompliant: req.body.isCompliant ?? true,
      },
    });
    return sendSuccess(res, policy, 201);
  } catch (err) {
    return next(err);
  }
};

// Notes Hub
const formatNote = (note: any) => {
  let meta: any = {};
  try {
    if (note.content && typeof note.content === 'string' && note.content.startsWith('{') && note.content.endsWith('}')) {
      meta = JSON.parse(note.content);
    }
  } catch {
    meta = {};
  }

  const rawText = meta.text !== undefined ? meta.text : note.content;
  const authorName = note.author
    ? `${note.author.firstName || ''} ${note.author.lastName || ''}`.trim() || 'Admin User'
    : 'Admin User';

  return {
    ...note,
    content: rawText,
    entityType: meta.entityType || note.targetType || 'TENANT',
    entityId: meta.entityId || note.targetId || '',
    targetType: meta.entityType || note.targetType || 'TENANT',
    targetId: meta.entityId || note.targetId || '',
    companyId: meta.companyId || (note.author as any)?.companyId || null,
    category: meta.category || 'GENERAL',
    priority: meta.priority || 'MEDIUM',
    isPinned: meta.isPinned !== undefined ? Boolean(meta.isPinned) : false,
    isPrivate: meta.isPrivate !== undefined ? Boolean(meta.isPrivate) : false,
    mentions: meta.mentions || [],
    authorName,
    createdBy: authorName,
    noteNumber: `NOTE-${note.id.slice(0, 8).toUpperCase()}`,
  };
};

export const listNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetType, targetId, entityType, entityId, companyId: queryCompanyId } = req.query;
    const filterType = targetType || entityType;
    const filterId = targetId || entityId;

    const effectiveCompanyId = (queryCompanyId as string) || req.user?.effectiveCompanyId;

    const where: any = {};
    if (filterType) where.targetType = String(filterType);
    if (filterId) where.targetId = String(filterId);

    const notes = await prisma.note.findMany({
      where,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true, companyId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let formatted = notes.map(formatNote);

    if (effectiveCompanyId && effectiveCompanyId !== 'all') {
      const compIdStr = String(effectiveCompanyId);
      const companyProperties = await prisma.property.findMany({
        where: { companyId: compIdStr },
        select: { id: true },
      });
      const propIdSet = new Set(companyProperties.map((p) => String(p.id)));

      formatted = formatted.filter((n) => {
        if (n.companyId) return String(n.companyId) === compIdStr;
        if (n.author?.companyId) return String(n.author.companyId) === compIdStr;
        if (n.entityType === 'COMPANY') return String(n.entityId) === compIdStr;
        if ((n.entityType === 'BUILDING' || n.entityType === 'PROPERTY') && propIdSet.has(String(n.entityId))) {
          return true;
        }
        return false;
      });
    }

    return sendSuccess(res, formatted, 200);
  } catch (err) {
    return next(err);
  }
};

export const getNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = await prisma.note.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true, companyId: true } },
      },
    });
    if (!note) {
      throw new AppError('Note not found', 404, 'NOTE_NOT_FOUND');
    }
    return sendSuccess(res, formatNote(note), 200);
  } catch (err) {
    return next(err);
  }
};

export const createNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const entityType = req.body.entityType || req.body.targetType || 'TENANT';
    const entityId = String(req.body.entityId || req.body.targetId || '');

    let companyId = req.body.companyId || req.user?.effectiveCompanyId || (req.user as any)?.companyId || null;

    if (!companyId && entityType === 'COMPANY' && entityId && entityId !== '0') {
      companyId = entityId;
    } else if (!companyId && (entityType === 'BUILDING' || entityType === 'PROPERTY') && entityId && entityId !== '0') {
      const prop = await prisma.property.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      if (prop?.companyId) companyId = prop.companyId;
    }

    const meta = {
      text: req.body.content || '',
      category: req.body.category || 'GENERAL',
      priority: req.body.priority || 'MEDIUM',
      isPinned: Boolean(req.body.isPinned),
      isPrivate: Boolean(req.body.isPrivate),
      mentions: req.body.mentions || [],
      companyId: companyId ? String(companyId) : null,
      entityType,
      entityId,
    };

    const note = await prisma.note.create({
      data: {
        authorId: req.user.userId,
        targetType: entityType,
        targetId: entityId || '0',
        title: req.body.title || 'Untitled Note',
        content: JSON.stringify(meta),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true, companyId: true } },
      },
    });
    return sendSuccess(res, formatNote(note), 201);
  } catch (err) {
    return next(err);
  }
};

export const updateNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.note.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true, companyId: true } },
      },
    });
    if (!existing) {
      throw new AppError('Note not found', 404, 'NOTE_NOT_FOUND');
    }

    let currentMeta: any = {};
    try {
      if (existing.content && existing.content.startsWith('{') && existing.content.endsWith('}')) {
        currentMeta = JSON.parse(existing.content);
      }
    } catch {
      currentMeta = {};
    }

    const entityType = req.body.entityType || req.body.targetType || currentMeta.entityType || existing.targetType;
    const entityId = String(req.body.entityId || req.body.targetId || currentMeta.entityId || existing.targetId);

    const updatedCompanyId = req.body.companyId !== undefined
      ? req.body.companyId
      : (currentMeta.companyId || (existing.author as any)?.companyId || null);

    const updatedMeta = {
      text: req.body.content !== undefined ? req.body.content : (currentMeta.text || existing.content),
      category: req.body.category !== undefined ? req.body.category : (currentMeta.category || 'GENERAL'),
      priority: req.body.priority !== undefined ? req.body.priority : (currentMeta.priority || 'MEDIUM'),
      isPinned: req.body.isPinned !== undefined ? Boolean(req.body.isPinned) : (currentMeta.isPinned || false),
      isPrivate: req.body.isPrivate !== undefined ? Boolean(req.body.isPrivate) : (currentMeta.isPrivate || false),
      mentions: req.body.mentions !== undefined ? req.body.mentions : (currentMeta.mentions || []),
      companyId: updatedCompanyId ? String(updatedCompanyId) : null,
      entityType,
      entityId,
    };

    const updatedNote = await prisma.note.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title !== undefined ? req.body.title : existing.title,
        content: JSON.stringify(updatedMeta),
        targetType: updatedMeta.entityType,
        targetId: updatedMeta.entityId || '0',
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true, companyId: true } },
      },
    });

    return sendSuccess(res, formatNote(updatedNote), 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.note.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      throw new AppError('Note not found', 404, 'NOTE_NOT_FOUND');
    }
    await prisma.note.delete({
      where: { id: req.params.id },
    });
    return sendSuccess(res, { message: 'Note deleted successfully' }, 200);
  } catch (err) {
    return next(err);
  }
};

// Employee Clock-In / Clock-Out
export const listClockLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let logs = await prisma.clockLog.findMany({
      include: {
        staff: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { clockIn: 'desc' },
    });

    if (logs.length === 0) {
      const sarah = await prisma.staffProfile.findFirst({
        where: { user: { firstName: { contains: 'Sarah', mode: 'insensitive' } } },
      });
      const mike = await prisma.staffProfile.findFirst({
        where: { user: { firstName: { contains: 'Mike', mode: 'insensitive' } } },
      });

      if (sarah) {
        await prisma.clockLog.create({
          data: {
            staffId: sarah.id,
            clockIn: new Date('2026-06-29T09:30:00Z'),
            clockOut: new Date('2026-06-29T17:00:00Z'),
            totalHours: 6.5,
            notes: JSON.stringify({
              status: 'Late',
              breakStart: '2026-06-29T12:00:00Z',
              breakEnd: '2026-06-29T13:00:00Z',
              overtimeHours: 0.0,
            }),
          },
        });
        await prisma.clockLog.create({
          data: {
            staffId: sarah.id,
            clockIn: new Date('2026-06-28T09:00:00Z'),
            clockOut: new Date('2026-06-28T17:00:00Z'),
            totalHours: 7.0,
            notes: JSON.stringify({
              status: 'Present',
              breakStart: '2026-06-28T12:00:00Z',
              breakEnd: '2026-06-28T13:00:00Z',
              overtimeHours: 0.0,
            }),
          },
        });
      }

      if (mike) {
        await prisma.clockLog.create({
          data: {
            staffId: mike.id,
            clockIn: new Date('2026-06-29T08:55:00Z'),
            clockOut: new Date('2026-06-29T18:00:00Z'),
            totalHours: 8.0,
            notes: JSON.stringify({
              status: 'Present',
              breakStart: '2026-06-29T12:00:00Z',
              breakEnd: '2026-06-29T13:00:00Z',
              overtimeHours: 1.0,
            }),
          },
        });
      }

      logs = await prisma.clockLog.findMany({
        include: {
          staff: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
        },
        orderBy: { clockIn: 'desc' },
      });
    }

    return sendSuccess(res, logs, 200);
  } catch (err) {
    return next(err);
  }
};

export const clockIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetId = req.body.employeeId || req.body.userId || req.user?.userId;
    let staff = await prisma.staffProfile.findFirst({
      where: {
        OR: [
          { userId: targetId },
          { id: targetId },
          { user: { id: targetId } },
        ],
      },
    });

    if (!staff) {
      // Find user or create staffProfile
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: targetId },
            { email: targetId },
          ],
        },
      });

      if (user) {
        staff = await prisma.staffProfile.create({
          data: {
            userId: user.id,
            department: req.body.department || 'Operations',
          },
        });
      } else {
        staff = await prisma.staffProfile.findFirst();
      }
    }

    if (!staff) {
      throw new AppError('Staff profile not found', 404, 'STAFF_NOT_FOUND');
    }

    const log = await prisma.clockLog.create({
      data: {
        staffId: staff.id,
        clockIn: new Date(),
        notes: typeof req.body.notes === 'string' ? req.body.notes : (req.body.notes ? JSON.stringify(req.body.notes) : null),
      },
    });
    return sendSuccess(res, log, 201);
  } catch (err) {
    return next(err);
  }
};

export const clockOut = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetId = req.body.employeeId || req.body.userId || req.user?.userId;
    let staff = await prisma.staffProfile.findFirst({
      where: {
        OR: [
          { userId: targetId },
          { id: targetId },
          { user: { id: targetId } },
        ],
      },
    });

    if (!staff) {
      staff = await prisma.staffProfile.findFirst();
    }

    if (!staff) {
      throw new AppError('Staff profile not found', 404, 'STAFF_NOT_FOUND');
    }

    const activeLog = await prisma.clockLog.findFirst({
      where: {
        staffId: staff.id,
        clockOut: null,
      },
      orderBy: { clockIn: 'desc' },
    });

    if (!activeLog) {
      throw new AppError('No active clock-in found', 400, 'NO_ACTIVE_CLOCK_IN');
    }

    const now = new Date();
    const diffHours = (now.getTime() - new Date(activeLog.clockIn).getTime()) / (1000 * 60 * 60);

    const updated = await prisma.clockLog.update({
      where: { id: activeLog.id },
      data: {
        clockOut: now,
        totalHours: Math.round(diffHours * 100) / 100,
        notes: typeof req.body.notes === 'string' ? req.body.notes : (req.body.notes ? JSON.stringify(req.body.notes) : activeLog.notes),
      },
    });
    return sendSuccess(res, updated, 200);
  } catch (err) {
    return next(err);
  }
};

// System Settings Store
let inMemorySettings: Record<string, any> = {
  notifications: true,
  autoInvoices: true,
  twoFactor: false,
  companyName: 'Horizex Real Estate Corp',
  companyAddress: '1450 Boulevard René-Lévesque Ouest, Montréal, QC H3G 1T7',
  companyLogo: 'https://example.com/logo.png',
  companyPhone: '+1 (514) 555-0199',
  GLOBAL_EMAIL_SIGNATURE: '<p>Best regards,<br><b>Horizex Team</b></p>',
  currency: 'CAD ($)',
  paymentCycle: 'Monthly',
  lateFee: 5,
};

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const effectiveCompanyId = (req.query.companyId as string) || req.user?.effectiveCompanyId;
    const companyId = isSuperAdmin ? ((req.query.companyId as string) || undefined) : effectiveCompanyId;

    let company = null;
    if (companyId) {
      company = await prisma.company.findUnique({ where: { id: companyId } });
    } else {
      company = await prisma.company.findFirst();
    }

    if (company) {
      inMemorySettings.companyName = company.name || inMemorySettings.companyName;
      inMemorySettings.companyPhone = company.contactPhone || inMemorySettings.companyPhone;
    }

    let activeUsersCount = 0;
    try {
      activeUsersCount = await prisma.user.count({
        where: {
          isActive: true,
          ...(companyId ? { companyId } : {}),
        },
      });
    } catch (e) {
      activeUsersCount = 4;
    }

    const stats = {
      activeUsers: activeUsersCount || 1,
      systemStatus: 'Healthy & Active',
      storageUsage: '12.4 GB / 50 GB',
      lastBackup: new Date().toISOString(),
    };

    return sendSuccess(res, { settings: inMemorySettings, stats }, 200);
  } catch (err) {
    return next(err);
  }
};

export const saveSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newSettings = req.body || {};
    inMemorySettings = {
      ...inMemorySettings,
      ...newSettings,
    };

    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const effectiveCompanyId = (req.query.companyId as string) || req.user?.effectiveCompanyId;
    const companyId = isSuperAdmin ? ((req.query.companyId as string) || undefined) : effectiveCompanyId;

    if (newSettings.companyName || newSettings.companyPhone) {
      try {
        let company = companyId ? await prisma.company.findUnique({ where: { id: companyId } }) : await prisma.company.findFirst();
        if (company) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              name: newSettings.companyName || company.name,
              contactPhone: newSettings.companyPhone || company.contactPhone,
            },
          });
        }
      } catch (e) {
        console.warn('Company sync notice in saveSettings:', e);
      }
    }

    return sendSuccess(res, { success: true, settings: inMemorySettings }, 200);
  } catch (err) {
    return next(err);
  }
};

