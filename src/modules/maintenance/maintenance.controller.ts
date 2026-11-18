import { Request, Response, NextFunction } from 'express';
import { MaintenanceService } from './maintenance.service';
import { sendSuccess } from '../../utils/apiResponse.util';
import { prisma } from '../../config/db';
import bcrypt from 'bcrypt';

function resolveCompanyId(req: Request): string | undefined {
  const reqComp = (req.query.companyId as string) || (req.headers['x-company-context'] as string) || req.user?.effectiveCompanyId;
  if (reqComp && reqComp !== 'all' && reqComp !== 'null' && reqComp !== 'undefined') {
    return reqComp;
  }
  const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
  return isAdmin ? undefined : (req.user?.companyId || undefined);
}

export const listTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req);
    const rawProp = req.query.propertyId as string | undefined;
    const propertyId = rawProp && rawProp !== 'all' && rawProp !== 'null' && rawProp !== 'undefined' ? rawProp : undefined;

    const tickets = await MaintenanceService.listTickets({
      companyId,
      propertyId,
      priority: req.query.priority,
      status: req.query.status,
    });
    return sendSuccess(res, tickets, 200);
  } catch (err) {
    return next(err);
  }
};

export const getTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req);

    const ticket = await MaintenanceService.getTicketById(req.params.id, companyId);
    return sendSuccess(res, ticket, 200);
  } catch (err) {
    return next(err);
  }
};

export const createTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req) || req.body.companyId;

    const ticket = await MaintenanceService.createTicket(req.body, companyId, req.user?.userId);
    return sendSuccess(res, ticket, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateTicketStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req);

    const updated = await MaintenanceService.updateTicketStatus(
      req.params.id,
      companyId,
      req.body,
      req.user?.userId
    );
    return sendSuccess(res, updated, 200);
  } catch (err) {
    return next(err);
  }
};

export const assignTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req);

    const updated = await MaintenanceService.assignTicket(
      req.params.id,
      companyId,
      req.body.staffProfileId,
      req.user?.userId
    );
    return sendSuccess(res, updated, 200);
  } catch (err) {
    return next(err);
  }
};

export const updateTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req);

    const updated = await MaintenanceService.updateTicket(
      req.params.id,
      companyId,
      req.body,
      req.user?.userId
    );
    return sendSuccess(res, updated, 200);
  } catch (err) {
    return next(err);
  }
};

export const deleteTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req);

    const result = await MaintenanceService.deleteTicket(
      req.params.id,
      companyId,
      req.user?.userId
    );
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const getTechniciansList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = resolveCompanyId(req);
    const whereStaff: any = {};
    if (companyId) {
      whereStaff.user = {
        OR: [
          { companyId },
          { companyId: null }
        ]
      };
    }

    const staffProfiles = await prisma.staffProfile.findMany({
      where: whereStaff,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true }
        },
        clockLogs: {
          orderBy: { clockIn: 'desc' },
          take: 1
        }
      }
    });

    const result = staffProfiles.map((s) => {
      const latestLog = s.clockLogs[0];
      let parsedNotes: any = {};
      if (latestLog?.notes) {
        try {
          parsedNotes = JSON.parse(latestLog.notes);
        } catch (e) {}
      }

      const fullName = parsedNotes.name || `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() || s.user.email;
      const role = parsedNotes.role || s.department || 'General Handyman';
      const isClockedIn = latestLog ? !latestLog.clockOut : false;
      const clockStatus = parsedNotes.clockStatus || (isClockedIn ? 'Clocked In' : 'Clocked Out');
      const totalHours = parsedNotes.totalHours !== undefined ? Number(parsedNotes.totalHours) : Number(latestLog?.totalHours || 0);
      const payrollHours = parsedNotes.payrollHours !== undefined ? Number(parsedNotes.payrollHours) : totalHours;

      return {
        id: s.id,
        technicianId: s.id,
        userId: s.userId,
        name: fullName,
        role,
        clockedIn: isClockedIn,
        clockStatus,
        totalHours,
        payrollHours,
      };
    });

    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

export const clockTechnician = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, role, clockStatus, totalHours, payrollHours } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Technician name is required' });
    }

    const companyId = resolveCompanyId(req) || null;
    const cleanName = String(name).trim();
    const parts = cleanName.split(' ');
    const firstName = parts[0] || 'Technician';
    const lastName = parts.slice(1).join(' ') || '';

    // Check if user already exists
    let user = await prisma.user.findFirst({
      where: {
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' }
      }
    });

    if (!user) {
      const dummyHash = await bcrypt.hash('TechDefaultPass123!', 10);
      const emailSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
      user = await prisma.user.create({
        data: {
          email: `${emailSlug || 'tech'}_${Date.now()}@horizex.internal`,
          firstName,
          lastName,
          passwordHash: dummyHash,
          role: 'MAINTENANCE_STAFF',
          companyId,
          isActive: true
        }
      });
    }

    let staff = await prisma.staffProfile.findUnique({
      where: { userId: user.id }
    });

    if (!staff) {
      staff = await prisma.staffProfile.create({
        data: {
          userId: user.id,
          department: role || 'General Handyman'
        }
      });
    } else if (role && staff.department !== role) {
      staff = await prisma.staffProfile.update({
        where: { id: staff.id },
        data: { department: role }
      });
    }

    const isClockedIn = clockStatus === 'Clocked In';
    const numTotal = Number(totalHours) || 0;
    const numPayroll = Number(payrollHours) || numTotal;

    const notesObj = {
      name: cleanName,
      role: role || staff.department,
      clockStatus: isClockedIn ? 'Clocked In' : 'Clocked Out',
      totalHours: numTotal,
      payrollHours: numPayroll,
      updatedAt: new Date().toISOString()
    };

    const clockLog = await prisma.clockLog.create({
      data: {
        staffId: staff.id,
        clockIn: new Date(),
        clockOut: isClockedIn ? null : new Date(),
        totalHours: numTotal,
        notes: JSON.stringify(notesObj)
      }
    });

    return sendSuccess(res, {
      id: staff.id,
      technicianId: staff.id,
      userId: user.id,
      name: cleanName,
      role: role || staff.department,
      clockStatus: notesObj.clockStatus,
      clockedIn: isClockedIn,
      totalHours: numTotal,
      payrollHours: numPayroll,
      clockLogId: clockLog.id
    }, 201);
  } catch (err) {
    return next(err);
  }
};
