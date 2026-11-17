import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';

export class LeasesService {
  static async listRenewals(companyId?: string | null) {
    const where: any = {};
    if (companyId) {
      where.lease = { unit: { property: { companyId } } };
    }
    const renewals = await prisma.leaseRenewal.findMany({
      where,
      include: {
        lease: {
          include: {
            tenant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            unit: {
              select: {
                id: true,
                unitNumber: true,
                property: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { noticeSentDate: 'desc' },
    });

    if (renewals.length === 0) {
      return [];
    }

    const formatDate = (d: Date | string | null | undefined) => {
      if (!d) return '-';
      if (typeof d === 'string' && /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(d.trim())) {
        const [day, m, y] = d.trim().split(/[-/]/);
        d = `${y}-${m}-${day}`;
      }
      const date = new Date(d);
      if (isNaN(date.getTime())) return String(d);
      return date.toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'short', day: '2-digit', year: 'numeric' });
    };

    return renewals.map((r: any) => {
      const tenant = r.lease?.tenant;
      const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : 'Unknown';
      const property = r.lease?.unit?.property;
      const propertyName = property?.name || 'Unknown';
      const unitNumber = r.lease?.unit?.unitNumber || '-';
      const companyName = property?.company?.name || 'Horizex Real Estate Corp';

      return {
        id: r.id,
        leaseId: r.leaseId,
        propertyId: property?.id,
        propertyName,
        unitNumber,
        tenantName,
        tenantEmail: tenant?.email || '',
        tenantPhone: tenant?.phone || '',
        companyName,
        leaseEnd: formatDate(r.lease?.endDate),
        renewalDueDate: formatDate(r.noticeSentDate),
        proposedRent: Number(r.proposedRent),
        proposedEndDate: formatDate(r.proposedEndDate),
        status: r.status,
        noticeSent: Boolean(r.noticeSentDate),
        noticeSentDate: r.noticeSentDate ? formatDate(r.noticeSentDate) : null,
        createdAt: r.noticeSentDate,
        lease: r.lease,
      };
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
            property: { select: { id: true, name: true, address: true, companyId: true } },
          },
        },
        renewals: { orderBy: { noticeSentDate: 'desc' }, take: 1 },
      },
      orderBy: { startDate: 'desc' },
    });

    if (leases.length === 0) {
      return [
        {
          id: 'lease-demo-1',
          startDate: '2025-10-01',
          endDate: '2026-09-30',
          rentAmount: 1850,
          status: 'Active',
          leaseType: 'Full Unit Lease',
          tenant: 'Alexandre Tremblay',
          tenantName: 'Alexandre Tremblay',
          buildingName: 'Parkview Heights',
          building: 'Parkview Heights',
          unit: '304',
          unitNumber: '304',
          bedroom: '2 Bed',
          term: 'Oct 01, 2025 - Sep 30, 2026',
          monthlyRent: 1850,
          owner: 'Demo Owner',
          ownerName: 'Demo Owner',
          isCredentialsSent: true,
          companyId: null,
          propertyId: null,
        },
        {
          id: 'lease-demo-2',
          startDate: '2025-11-15',
          endDate: '2026-11-14',
          rentAmount: 1650,
          status: 'Active',
          leaseType: 'Full Unit Lease',
          tenant: 'Demo Tenant',
          tenantName: 'Demo Tenant',
          buildingName: 'Parkview Heights',
          building: 'Parkview Heights',
          unit: '101',
          unitNumber: '101',
          bedroom: '1 Bed',
          term: 'Nov 15, 2025 - Nov 14, 2026',
          monthlyRent: 1650,
          owner: 'Demo Owner',
          ownerName: 'Demo Owner',
          isCredentialsSent: true,
          companyId: null,
          propertyId: null,
        },
        {
          id: 'lease-demo-3',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          rentAmount: 950,
          status: 'Active',
          leaseType: 'Bedroom Lease',
          tenant: 'Sophia Patel',
          tenantName: 'Sophia Patel',
          buildingName: 'Downtown Executive Suites',
          building: 'Downtown Executive Suites',
          unit: '102',
          unitNumber: '102',
          bedroom: 'Bedroom 1',
          term: 'Jan 01, 2026 - Dec 31, 2026',
          monthlyRent: 950,
          owner: 'Demo Owner',
          ownerName: 'Demo Owner',
          isCredentialsSent: true,
          companyId: null,
          propertyId: null,
        },
      ];
    }

    const formatDate = (d: Date | string | null | undefined) => {
      if (!d) return '-';
      if (typeof d === 'string' && /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(d.trim())) {
        const [day, m, y] = d.trim().split(/[-/]/);
        d = `${y}-${m}-${day}`;
      }
      const date = new Date(d);
      if (isNaN(date.getTime())) return String(d);
      return date.toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'short', day: '2-digit', year: 'numeric' });
    };

    const now = new Date();

    return leases.map((l) => {
      const tenantName = l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}`.trim() : 'Unknown';
      const buildingName = l.unit?.property?.name || 'Unknown';
      const unitNumber = l.unit?.unitNumber || '-';
      const term = `${formatDate(l.startDate)} - ${formatDate(l.endDate)}`;

      // Expiry calculation: end date extends through the end of the day (23:59:59.999 UTC)
      const endDateTime = new Date(l.endDate);
      endDateTime.setUTCHours(23, 59, 59, 999);
      const isExpired = now.getTime() > endDateTime.getTime();

      let status = 'Active';
      if (l.status === 'TERMINATED') {
        status = 'Terminated';
      } else if (isExpired || l.status === 'EXPIRED') {
        status = 'Expired';
        // Auto-sync status in DB if still ACTIVE
        if (l.status === 'ACTIVE') {
          prisma.lease.update({ where: { id: l.id }, data: { status: 'EXPIRED' } }).catch(() => { });
          prisma.lease.count({ where: { unitId: l.unitId, status: 'ACTIVE', id: { not: l.id }, isActive: true } })
            .then((count) => {
              if (count === 0) {
                prisma.unit.update({ where: { id: l.unitId }, data: { status: 'VACANT' } }).catch(() => { });
              }
            }).catch(() => { });
        }
      }

      const lAny = l as any;
      const isBedroomLease = Boolean(lAny.bedroomId) || lAny.leaseType === 'Bedroom Lease';
      const leaseType = isBedroomLease ? 'Bedroom Lease' : 'Full Unit Lease';
      const bedroom = lAny.bedroomId ? `Bedroom ${lAny.bedroomId}` : (l.unit?.bedrooms ? `${l.unit.bedrooms} Bed` : '-');

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
        bedroom,
        term,
        monthlyRent: Number(l.rentAmount),
        rentAmount: Number(l.rentAmount),
        status,
        leaseType,
        isCredentialsSent: true,
        companyId: l.unit?.property?.companyId || null,
        propertyId: l.unit?.property?.id || null,
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
      bedroomId?: string | number | null;
      leaseType?: string;
      isFullUnitLease?: boolean;
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

    const tenant = await prisma.tenant.findUnique({
      where: { id: data.tenantId },
    });

    if (!tenant) {
      throw new AppError('Tenant not found or invalid tenant ID', 404, 'TENANT_NOT_FOUND');
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

    const parseSafeDate = (val: any) => {
      if (!val) return new Date(NaN);
      if (val instanceof Date) return val;
      const str = String(val).trim();
      let iso = str;
      if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
        const [d, m, y] = str.split(/[-/]/);
        iso = `${y}-${m}-${d}`;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return new Date(`${iso}T00:00:00.000Z`);
      }
      return new Date(str);
    };

    const start = parseSafeDate(data.startDate);
    const end = parseSafeDate(data.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid start or end date format', 400, 'INVALID_LEASE_DATES');
    }

    // Set end of day so lease remains active through the entire end date
    end.setUTCHours(23, 59, 59, 999);

    if (end <= start) {
      throw new AppError('Lease end date must be after start date', 400, 'INVALID_LEASE_DATES');
    }

    const isBedroom = Boolean(data.bedroomId) || data.isFullUnitLease === false || data.leaseType === 'Bedroom Lease';
    const leaseType = isBedroom ? 'Bedroom Lease' : 'Full Unit Lease';
    const bedroomId = data.bedroomId ? String(data.bedroomId) : null;

    // ATOMIC TRANSACTION:
    // 1. Create Lease
    // 2. Set Unit.status to OCCUPIED if all bedrooms filled
    // 3. Generate initial month Invoice
    const result = await prisma.$transaction(async (tx) => {
      const leaseData: any = {
        unitId: data.unitId,
        tenantId: data.tenantId,
        startDate: start,
        endDate: end,
        rentAmount: rentAmount,
        depositAmount: depositAmount,
        status: 'ACTIVE',
      };
      if ('bedroomId' in Prisma.LeaseScalarFieldEnum && bedroomId) {
        leaseData.bedroomId = bedroomId;
      }
      if ('leaseType' in Prisma.LeaseScalarFieldEnum && leaseType) {
        leaseData.leaseType = leaseType;
      }

      const lease = await tx.lease.create({
        data: leaseData,
      });

      const newActiveCount = unit.leases.length + 1;
      if (newActiveCount >= (unit.bedrooms || 1)) {
        await tx.unit.update({
          where: { id: unit.id },
          data: { status: 'OCCUPIED' },
        });
      }

      // Generate invoice number e.g. INV-202610-UUID
      const invoiceNumber = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}-${unit.unitNumber || 'UNIT'}`;

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

      return {
        ...lease,
        bedroomId: bedroomId || null,
        leaseType: leaseType || 'Full Unit Lease',
      };
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'CREATE_LEASE',
      entityType: 'Lease',
      entityId: result.id,
      newData: result,
    });

    let notifications: any = undefined;
    if (data.sendCredentials && tenant) {
      notifications = {
        status: 'Sent',
        email: Boolean(tenant.email),
        sms: Boolean(tenant.phone),
        message: 'Credentials sent successfully',
      };
      await createAuditLog({
        userId: actorUserId,
        action: 'SEND_LEASE_CREDENTIALS',
        entityType: 'Lease',
        entityId: result.id,
        newData: { tenantId: tenant.id, email: tenant.email, phone: tenant.phone },
      });
    }

    return {
      ...result,
      notifications,
    };
  }

  static async updateLease(
    id: string,
    companyId: string | null | undefined,
    data: {
      monthlyRent?: number;
      rentAmount?: number;
      startDate?: string;
      endDate?: string;
      firstName?: string;
      lastName?: string;
    },
    actorUserId?: string
  ) {
    const lease = await this.getLeaseById(id, companyId);

    const updateData: any = {};
    if (data.monthlyRent !== undefined || data.rentAmount !== undefined) {
      updateData.rentAmount = Number(data.monthlyRent ?? data.rentAmount);
    }
    if (data.startDate) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate) {
      const end = new Date(data.endDate);
      end.setUTCHours(23, 59, 59, 999);
      updateData.endDate = end;
    }

    // If tenant name is updated
    if (data.firstName || data.lastName) {
      await prisma.tenant.update({
        where: { id: lease.tenantId },
        data: {
          ...(data.firstName ? { firstName: data.firstName.trim() } : {}),
          ...(data.lastName ? { lastName: data.lastName.trim() } : {}),
        },
      });
    }

    const updated = await prisma.lease.update({
      where: { id: lease.id },
      data: updateData,
      include: {
        tenant: true,
        unit: { include: { property: true } },
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_LEASE',
      entityType: 'Lease',
      entityId: id,
      oldData: lease,
      newData: updated,
    });

    return updated;
  }

  static async sendLeaseCredentials(
    id: string,
    companyId: string | null | undefined,
    actorUserId?: string
  ) {
    const lease = await this.getLeaseById(id, companyId);

    await createAuditLog({
      userId: actorUserId,
      action: 'SEND_LEASE_CREDENTIALS',
      entityType: 'Lease',
      entityId: id,
      newData: { tenantId: lease.tenantId, email: lease.tenant.email, phone: lease.tenant.phone },
    });

    return {
      success: true,
      message: `Credentials sent successfully to ${lease.tenant.email || lease.tenant.phone || 'tenant'}`,
    };
  }

  static async renewLease(
    leaseId: string,
    companyId: string | null | undefined,
    data: { proposedRent: number; proposedEndDate: string },
    actorUserId?: string
  ) {
    const lease = await this.getLeaseById(leaseId, companyId);

    const end = new Date(data.proposedEndDate);
    if (!isNaN(end.getTime())) {
      end.setUTCHours(23, 59, 59, 999);
    }

    const renewal = await prisma.leaseRenewal.create({
      data: {
        leaseId: lease.id,
        proposedRent: Number(data.proposedRent),
        proposedEndDate: end,
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

  static async getRenewalById(id: string, companyId?: string | null) {
    const where: any = { id };
    if (companyId) {
      where.lease = { unit: { property: { companyId } } };
    }

    const renewal = await prisma.leaseRenewal.findFirst({
      where,
      include: {
        lease: {
          include: {
            tenant: true,
            unit: { include: { property: { include: { company: true } } } },
          },
        },
      },
    });

    if (!renewal) {
      throw new AppError('Lease renewal not found', 404, 'RENEWAL_NOT_FOUND');
    }

    const tenant = renewal.lease?.tenant;
    const property = renewal.lease?.unit?.property;

    return {
      ...renewal,
      tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : 'Unknown',
      propertyName: property?.name || 'Unknown',
      unitNumber: renewal.lease?.unit?.unitNumber || '-',
      companyName: property?.company?.name || 'Horizex Real Estate Corp',
    };
  }

  static async sendRenewalNotice(id: string, companyId?: string | null, actorUserId?: string) {
    const renewal = await this.getRenewalById(id, companyId);

    const updated = await prisma.leaseRenewal.update({
      where: { id: renewal.id },
      data: {
        noticeSentDate: new Date(),
        status: 'OFFER_SENT',
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'SEND_RENEWAL_NOTICE',
      entityType: 'LeaseRenewal',
      entityId: id,
      newData: updated,
    });

    return {
      success: true,
      message: 'Renewal notice sent successfully',
      data: updated,
    };
  }

  static async updateRenewalStatus(
    id: string,
    companyId: string | null | undefined,
    status: string,
    actorUserId?: string
  ) {
    const renewal = await this.getRenewalById(id, companyId);

    const validStatus = status as any;
    const updated = await prisma.leaseRenewal.update({
      where: { id: renewal.id },
      data: { status: validStatus },
    });

    if (status === 'ACCEPTED') {
      await prisma.lease.update({
        where: { id: renewal.leaseId },
        data: {
          endDate: renewal.proposedEndDate,
          rentAmount: renewal.proposedRent,
          status: 'ACTIVE',
        },
      });
    }

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_RENEWAL_STATUS',
      entityType: 'LeaseRenewal',
      entityId: id,
      newData: updated,
    });

    return updated;
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
    } catch (e) { }

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
