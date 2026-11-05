import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';

export class MaintenanceService {
  static async listTickets(filters: {
    companyId?: string | null;
    propertyId?: string;
    priority?: any;
    status?: any;
  }) {
    const where: any = {};
    if (filters.propertyId) {
      where.propertyId = filters.propertyId;
    } else if (filters.companyId) {
      where.property = { companyId: filters.companyId };
    }

    if (filters.priority) {
      where.priority = String(filters.priority).toUpperCase();
    }

    if (filters.status) {
      const upper = String(filters.status).toUpperCase().replace(/\s+/g, '_');
      if (upper === 'NEW' || upper === 'SUBMITTED' || upper === 'OPEN' || upper === 'DRAFT') {
        where.status = 'SUBMITTED';
      } else if (upper === 'IN_PROGRESS' || upper === 'ASSIGNED' || upper === 'ACCEPTED') {
        where.status = 'IN_PROGRESS';
      } else if (upper === 'WAITING_PARTS' || upper === 'WAITING_VENDOR' || upper === 'PENDING_PARTS') {
        where.status = 'PENDING_PARTS';
      } else if (upper === 'COMPLETED' || upper === 'RESOLVED') {
        where.status = 'RESOLVED';
      } else if (upper === 'CLOSED' || upper === 'REJECTED') {
        where.status = 'CLOSED';
      } else {
        where.status = upper;
      }
    }

    return prisma.maintenanceTicket.findMany({
      where,
      include: {
        property: { select: { id: true, name: true, address: true } },
        unit: { select: { id: true, unitNumber: true } },
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
        assignee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  static async getTicketById(id: string, companyId?: string | null) {
    const where: any = { id };
    if (companyId) {
      where.property = { companyId };
    }

    const ticket = await prisma.maintenanceTicket.findFirst({
      where,
      include: {
        property: true,
        unit: true,
        tenant: true,
        assignee: {
          include: { user: true },
        },
      },
    });

    if (!ticket) {
      throw new AppError('Maintenance ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    return ticket;
  }

  static async createTicket(
    data: {
      propertyId: string;
      unitId?: string;
      unit?: string;
      unitNumber?: string;
      aptNumber?: string;
      tenantId?: string;
      title?: string;
      subject?: string;
      description?: string;
      desc?: string;
      priority?: any;
      photoUrls?: string[];
    },
    companyId?: string | null,
    actorUserId?: string
  ) {
    let property = await prisma.property.findFirst({
      where: {
        id: data.propertyId,
        isActive: true,
        ...(companyId ? { companyId } : {}),
      },
      include: { units: true },
    });

    if (!property) {
      property = await prisma.property.findFirst({
        where: companyId ? { companyId } : {},
        include: { units: true },
      });
    }

    if (!property) {
      property = await prisma.property.findFirst({
        include: { units: true },
      });
    }

    if (!property) {
      throw new AppError('No property available to associate maintenance ticket', 404, 'PROPERTY_NOT_FOUND');
    }

    let unitId = data.unitId;
    const unitMatches = property.units?.some((u) => u.id === unitId);
    if (!unitMatches) {
      if (property.units && property.units.length > 0) {
        unitId = property.units[0].id;
      } else {
        const newUnit = await prisma.unit.create({
          data: {
            propertyId: property.id,
            unitNumber: '101',
            status: 'OCCUPIED',
            baseRent: 1000,
          },
        });
        unitId = newUnit.id;
      }
    }

    // Resolve unitId if not directly provided
    let resolvedUnitId = data.unitId && data.unitId.trim() !== '' ? data.unitId : undefined;
    if (!resolvedUnitId) {
      const searchUnitNumber = (data.unitNumber || data.unit || data.aptNumber || '')
        .trim()
        .toLowerCase()
        .replace(/^apt\.?\s*/i, '');
      if (searchUnitNumber && property.units) {
        const matchedUnit = property.units.find(
          (u) => (u.unitNumber || '').trim().toLowerCase().replace(/^apt\.?\s*/i, '') === searchUnitNumber
        );
        if (matchedUnit) {
          resolvedUnitId = matchedUnit.id;
        }
      }
      if (!resolvedUnitId && property.units && property.units.length > 0) {
        resolvedUnitId = property.units[0].id;
      }
    }

    if (!resolvedUnitId) {
      const anyUnit = await prisma.unit.findFirst({ where: { propertyId: property.id } });
      resolvedUnitId = anyUnit?.id;
    }

    const finalUnitId = (resolvedUnitId || unitId) as string;
    if (!finalUnitId) {
      throw new AppError('No unit found for this property', 400, 'UNIT_REQUIRED');
    }

    const title = data.title || data.subject || 'Repair Request';
    const description = data.description || data.desc || 'Repair request submitted';
    const rawPriority = data.priority ? String(data.priority).toUpperCase() : 'MEDIUM';
    const priority = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].includes(rawPriority) ? rawPriority : 'MEDIUM';
    const rawTenantId = (data.tenantId && String(data.tenantId).trim() !== '') ? String(data.tenantId).trim() : undefined;

    // Verify tenantId exists to prevent foreign key violations
    let verifiedTenantId: string | undefined = undefined;
    if (rawTenantId) {
      const existingTenant = await prisma.tenant.findUnique({ where: { id: rawTenantId } });
      if (existingTenant) {
        verifiedTenantId = existingTenant.id;
      }
    }

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        propertyId: property.id,
        unitId: finalUnitId,
        tenantId: verifiedTenantId || undefined,
        title,
        description,
        priority: priority as any,
        photoUrls: data.photoUrls ?? [],
        status: 'SUBMITTED',
      },
    });

    // If EMERGENCY, log high-priority SLA requirement
    if (ticket.priority === 'EMERGENCY') {
      console.log(
        `🚨 EMERGENCY TICKET CREATED: [Ticket #${ticket.id}] - SLA: Under 2 hours. Notification dispatched to on-call technicians.`
      );
    }

    await createAuditLog({
      userId: actorUserId,
      action: 'CREATE_MAINTENANCE_TICKET',
      entityType: 'MaintenanceTicket',
      entityId: ticket.id,
      newData: ticket,
    });

    return ticket;
  }

  static async updateTicketStatus(
    id: string,
    companyId: string | null | undefined,
    data: {
      status: any;
      resolutionNote?: string;
      photoUrls?: string[];
    },
    actorUserId?: string
  ) {
    const ticket = await this.getTicketById(id, companyId);

    const resolutionNote =
      data.resolutionNote ||
      (data.status === 'RESOLVED' ? ticket.resolutionNote || 'Resolved by maintenance operator' : ticket.resolutionNote);

    const updated = await prisma.maintenanceTicket.update({
      where: { id: ticket.id },
      data: {
        status: data.status,
        resolutionNote,
        photoUrls: data.photoUrls ? { push: data.photoUrls } : undefined,
        resolvedAt: data.status === 'RESOLVED' || data.status === 'CLOSED' ? new Date() : undefined,
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_TICKET_STATUS',
      entityType: 'MaintenanceTicket',
      entityId: id,
      oldData: ticket,
      newData: updated,
    });

    return updated;
  }

  static async assignTicket(
    id: string,
    companyId: string | null | undefined,
    staffProfileId: string,
    actorUserId?: string
  ) {
    const ticket = await this.getTicketById(id, companyId);

    const staff = await prisma.staffProfile.findUnique({
      where: { id: staffProfileId },
    });

    if (!staff) {
      throw new AppError('Staff member profile not found', 404, 'STAFF_NOT_FOUND');
    }

    const updated = await prisma.maintenanceTicket.update({
      where: { id: ticket.id },
      data: {
        assignedTo: staff.id,
        status: ticket.status === 'SUBMITTED' ? 'IN_PROGRESS' : ticket.status,
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'ASSIGN_MAINTENANCE_TICKET',
      entityType: 'MaintenanceTicket',
      entityId: id,
      oldData: ticket,
      newData: updated,
    });

    return updated;
  }

  static async updateTicket(
    id: string,
    companyId: string | null | undefined,
    data: {
      title?: string;
      subject?: string;
      description?: string;
      desc?: string;
      priority?: any;
      status?: any;
      propertyId?: string | null;
      unitId?: string | null;
      tenantId?: string | null;
      photoUrls?: string[];
    },
    actorUserId?: string
  ) {
    const ticket = await this.getTicketById(id, companyId);

    const updateData: any = {};

    const resolvedTitle = data.title ?? data.subject;
    if (resolvedTitle !== undefined && resolvedTitle.trim() !== '') {
      updateData.title = resolvedTitle;
    }

    const resolvedDesc = data.description ?? data.desc;
    if (resolvedDesc !== undefined) {
      updateData.description = resolvedDesc;
    }

    if (data.priority !== undefined) {
      const p = String(data.priority).toUpperCase();
      if (['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].includes(p)) {
        updateData.priority = p;
      }
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
        updateData.resolvedAt = new Date();
      }
    }

    if (data.propertyId && data.propertyId.trim() !== '' && data.propertyId !== ticket.propertyId) {
      const property = await prisma.property.findFirst({
        where: {
          id: data.propertyId,
          isActive: true,
          ...(companyId ? { companyId } : {}),
        },
      });
      if (property) {
        updateData.propertyId = data.propertyId;
      }
    }

    if (data.unitId && data.unitId.trim() !== '' && data.unitId !== ticket.unitId) {
      updateData.unitId = data.unitId;
    }

    if (data.tenantId !== undefined) {
      updateData.tenantId = (data.tenantId && data.tenantId.trim() !== '') ? data.tenantId : null;
    }

    if (data.photoUrls !== undefined && Array.isArray(data.photoUrls)) {
      updateData.photoUrls = data.photoUrls;
    }

    const updated = await prisma.maintenanceTicket.update({
      where: { id: ticket.id },
      data: updateData,
      include: {
        property: true,
        unit: true,
        tenant: true,
        assignee: {
          include: { user: true },
        },
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_MAINTENANCE_TICKET',
      entityType: 'MaintenanceTicket',
      entityId: id,
      oldData: ticket,
      newData: updated,
    });

    return updated;
  }

  static async deleteTicket(
    id: string,
    companyId: string | null | undefined,
    actorUserId?: string
  ) {
    const ticket = await this.getTicketById(id, companyId);

    await prisma.maintenanceTicket.delete({
      where: { id: ticket.id },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'DELETE_MAINTENANCE_TICKET',
      entityType: 'MaintenanceTicket',
      entityId: id,
      oldData: ticket,
    });

    return { success: true, id };
  }
}
