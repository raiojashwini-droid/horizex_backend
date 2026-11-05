import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';

export class LeasesService {
  static async listRenewals(companyId?: string | null) {
    const where: any = {};
    if (companyId) {
      where.lease = { unit: { property: { companyId } } };
    }
    return prisma.leaseRenewal.findMany({
      where,
      include: {
        lease: {
          include: {
            tenant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            unit: {
              select: {
                id: true,
                unitNumber: true,
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { noticeSentDate: 'desc' },
    });
  }

  static async listLeases(filters: {
    companyId?: string | null;
    status?: any;
    expiringWithinDays?: number;
  }) {
    const where: any = { isActive: true };

    if (filters.companyId) {
      where.unit = { property: { companyId: filters.companyId } };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.expiringWithinDays) {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + filters.expiringWithinDays);
      where.endDate = { gte: now, lte: future };
    }

    const leases = await prisma.lease.findMany({
      where,
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            bedrooms: true,
            property: { select: { id: true, name: true, address: true } },
          },
        },
        renewals: { orderBy: { noticeSentDate: 'desc' }, take: 1 },
      },
      orderBy: { startDate: 'desc' },
    });

    const formatDate = (d: Date | string) => {
      const date = new Date(d);
      return date.toLocaleDateString('en-CA', { month: 'short', day: '2-digit', year: 'numeric' });
    };

    return leases.map((l) => {
      const tenantName = l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}`.trim() : 'Unknown';
      const buildingName = l.unit?.property?.name || 'Unknown';
      const unitNumber = l.unit?.unitNumber || '-';
      const term = `${formatDate(l.startDate)} - ${formatDate(l.endDate)}`;
      const status = l.status === 'ACTIVE' ? 'Active' : 'Expired';

      return {
        ...l,
        tenantObj: l.tenant,
        unitObj: l.unit,
        tenant: tenantName,
        tenantName,
        buildingName,
        building: buildingName,
        unit: unitNumber,
        unitNumber,
        bedroom: l.unit?.bedrooms ? `${l.unit.bedrooms} Bed` : '-',
        term,
        monthlyRent: Number(l.rentAmount),
        rentAmount: Number(l.rentAmount),
        status,
        leaseType: 'Full Unit Lease',
        isCredentialsSent: true,
      };
    });
  }

  static async getLeaseById(id: string, companyId?: string | null) {
    const where: any = { id, isActive: true };
    if (companyId) {
      where.unit = { property: { companyId } };
    }

    const lease = await prisma.lease.findFirst({
      where,
      include: {
        tenant: true,
        unit: { include: { property: true } },
        renewals: { orderBy: { noticeSentDate: 'desc' } },
        invoices: { orderBy: { dueDate: 'desc' } },
        moveInspections: { orderBy: { inspectionDate: 'desc' } },
      },
    });

    if (!lease) {
      throw new AppError('Lease agreement not found', 404, 'LEASE_NOT_FOUND');
    }

    return lease;
  }

  static async createLease(
    data: {
      unitId: string;
      tenantId: string;
      startDate: string;
      endDate: string;
      rentAmount?: number;
      monthlyRent?: number;
      depositAmount?: number;
      securityDeposit?: number;
      [key: string]: any;
    },
    companyId?: string | null,
    actorUserId?: string
  ) {
    const unit = await prisma.unit.findFirst({
      where: {
        id: data.unitId,
        isActive: true,
        ...(companyId ? { property: { companyId } } : {}),
      },
      include: {
        leases: { where: { status: 'ACTIVE', isActive: true } },
      },
    });

    if (!unit) {
      throw new AppError('Unit not found or access denied', 404, 'UNIT_NOT_FOUND');
    }

    const rentAmount = Number(data.rentAmount ?? data.monthlyRent) || 0;
    const depositAmount = Number(data.depositAmount ?? data.securityDeposit) || 0;

    // BUSINESS RULE: Check unit status and split-bedroom lease limit
    if (unit.status === 'OCCUPIED' && unit.leases.length >= unit.bedrooms) {
      throw new AppError(
        `Unit is already fully occupied. Maximum active leases allowed: ${unit.bedrooms}`,
        400,
        'UNIT_ALREADY_OCCUPIED'
      );
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid start or end date format', 400, 'INVALID_LEASE_DATES');
    }

    if (end <= start) {
      throw new AppError('Lease end date must be after start date', 400, 'INVALID_LEASE_DATES');
    }

    // ATOMIC TRANSACTION:
    // 1. Create Lease
    // 2. Set Unit.status to OCCUPIED if all bedrooms filled
    // 3. Generate initial month Invoice
    const result = await prisma.$transaction(async (tx) => {
      const lease = await tx.lease.create({
        data: {
          unitId: data.unitId,
          tenantId: data.tenantId,
          startDate: start,
          endDate: end,
          rentAmount: rentAmount,
          depositAmount: depositAmount,
          status: 'ACTIVE',
        },
      });

      const newActiveCount = unit.leases.length + 1;
      if (newActiveCount >= (unit.bedrooms || 1)) {
        await tx.unit.update({
          where: { id: unit.id },
          data: { status: 'OCCUPIED' },
        });
      }

      // Generate invoice number e.g. INV-202610-UUID
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${unit.unitNumber}`;

      await tx.invoice.create({
        data: {
          leaseId: lease.id,
          tenantId: data.tenantId,
          invoiceNumber,
          amountDue: rentAmount,
          amountPaid: 0,
          dueDate: start,
          status: 'UNPAID',
        },
      });

      return lease;
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'CREATE_LEASE',
      entityType: 'Lease',
      entityId: result.id,
      newData: result,
    });

    return result;
  }

  static async renewLease(
    leaseId: string,
    companyId: string | null | undefined,
    data: { proposedRent: number; proposedEndDate: string },
    actorUserId?: string
  ) {
    const lease = await this.getLeaseById(leaseId, companyId);

    const renewal = await prisma.leaseRenewal.create({
      data: {
        leaseId: lease.id,
        proposedRent: data.proposedRent,
        proposedEndDate: new Date(data.proposedEndDate),
        noticeSentDate: new Date(),
        status: 'OFFER_SENT',
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'ISSUE_LEASE_RENEWAL',
      entityType: 'LeaseRenewal',
      entityId: renewal.id,
      newData: renewal,
    });

    return renewal;
  }

  static async addMoveInspection(
    leaseId: string,
    companyId: string | null | undefined,
    data: {
      type: 'MOVE_IN' | 'MOVE_OUT';
      inspectorName: string;
      checklistJson: any;
      mediaUrls: string[];
      signedByTenant?: boolean;
    },
    actorUserId?: string
  ) {
    const lease = await this.getLeaseById(leaseId, companyId);

    const inspection = await prisma.moveInspection.create({
      data: {
        leaseId: lease.id,
        unitId: lease.unitId,
        type: data.type,
        inspectorName: data.inspectorName,
        checklistJson: data.checklistJson,
        mediaUrls: data.mediaUrls,
        signedByTenant: data.signedByTenant ?? false,
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'RECORD_MOVE_INSPECTION',
      entityType: 'MoveInspection',
      entityId: inspection.id,
      newData: inspection,
    });

    return inspection;
  }

  static async deleteLease(id: string, companyId?: string | null, actorUserId?: string) {
    const lease = await this.getLeaseById(id, companyId);

    // 1. If unit was occupied by this lease, free the unit
    try {
      await prisma.unit.update({
        where: { id: lease.unitId },
        data: { status: 'VACANT' },
      });
    } catch (e) {}

    // 2. Soft delete or delete lease
    let deleted;
    try {
      deleted = await prisma.lease.delete({
        where: { id: lease.id },
      });
    } catch (e) {
      deleted = await prisma.lease.update({
        where: { id: lease.id },
        data: { status: 'TERMINATED', isActive: false },
      });
    }

    await createAuditLog({
      userId: actorUserId,
      action: 'DELETE_LEASE',
      entityType: 'Lease',
      entityId: id,
      oldData: lease,
      newData: deleted,
    });

    return { message: 'Lease deleted successfully' };
  }
}

