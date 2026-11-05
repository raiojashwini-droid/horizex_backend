import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';

export class TenantsService {
  static async listTenants(companyId?: string | null, search?: string) {
    const where: any = { isActive: true };
    if (companyId) {
      where.companyId = companyId;
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { emergencyContact: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        company: {
          select: { id: true, name: true, code: true },
        },
        leases: {
          where: { status: 'ACTIVE', isActive: true },
          include: {
            unit: {
              include: {
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
        invoices: {
          where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
          select: { amountDue: true, amountPaid: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((tenant) => {
      const activeLease = tenant.leases[0] || null;
      const totalBalanceDue = tenant.invoices.reduce(
        (sum, inv) => sum + (Number(inv.amountDue) - Number(inv.amountPaid)),
        0
      );

      let meta: any = {};
      if (tenant.emergencyContact) {
        try {
          meta = JSON.parse(tenant.emergencyContact);
        } catch {
          meta = { emergencyContact: tenant.emergencyContact };
        }
      }

      const type = meta.type || 'Individual';
      const isInternalEmail = tenant.email.includes('@occupant.internal');
      const displayEmail = isInternalEmail ? '' : tenant.email;

      return {
        id: tenant.id,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        name: `${tenant.firstName} ${tenant.lastName}`.trim(),
        email: displayEmail,
        phone: tenant.phone,
        type,
        companyId: tenant.companyId,
        companyName: meta.companyName || tenant.company?.name || '',
        companyCode: tenant.company?.code || '',
        company: tenant.company,
        property: activeLease?.unit?.property?.name || meta.propertyName || '-',
        propertyName: activeLease?.unit?.property?.name || meta.propertyName || '-',
        unit: activeLease?.unit?.unitNumber || meta.unitNumber || '-',
        unitNumber: activeLease?.unit?.unitNumber || meta.unitNumber || '-',
        activeUnit: activeLease
          ? `${activeLease.unit.property.name} - Unit ${activeLease.unit.unitNumber}`
          : (meta.unitNumber ? `Unit ${meta.unitNumber}` : 'No Active Lease'),
        activeLeaseId: activeLease?.id || null,
        leaseStatus: activeLease ? 'Active' : (type === 'Resident' || type === 'RESIDENT' ? 'Resident' : 'None'),
        balanceDue: Math.round(totalBalanceDue * 100) / 100,
        createdAt: tenant.createdAt,
        parentId: meta.parentId || null,
        propertyId: meta.propertyId || activeLease?.unit?.property?.id || null,
        unitId: meta.unitId || activeLease?.unit?.id || null,
        bedroomId: meta.bedroomId || null,
        street: meta.street || '',
        city: meta.city || '',
        state: meta.state || '',
        postalCode: meta.postalCode || '',
        country: meta.country || '',
        companyDetails: meta.companyDetails || '',
        companyContacts: meta.companyContacts || [],
        residents: meta.residents || [],
        emergencyContact: meta.emergencyContact || null,
      };
    });

  }

  static async getTenantById(id: string, companyId?: string | null) {
    const where: any = { id, isActive: true };
    if (companyId) {
      where.companyId = companyId;
    }

    const tenant = await prisma.tenant.findFirst({
      where,
      include: {
        company: {
          select: { id: true, name: true, code: true },
        },
        leases: {
          where: { isActive: true },
          include: {
            unit: { include: { property: true } },
          },
          orderBy: { startDate: 'desc' },
        },
        invoices: {
          orderBy: { dueDate: 'desc' },
          include: { payments: true },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
        },
        vehicles: {
          include: { unit: true },
        },
        credits: true,
      },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    let meta: any = {};
    if (tenant.emergencyContact) {
      try {
        meta = JSON.parse(tenant.emergencyContact);
      } catch {
        meta = { emergencyContact: tenant.emergencyContact };
      }
    }

    // Resolve parent tenant if resident
    let parent = null;
    if (meta.parentId) {
      const parentTenant = await prisma.tenant.findUnique({
        where: { id: meta.parentId },
        include: { company: true },
      });
      if (parentTenant) {
        let parentMeta: any = {};
        if (parentTenant.emergencyContact) {
          try {
            parentMeta = JSON.parse(parentTenant.emergencyContact);
          } catch {
            parentMeta = {};
          }
        }
        parent = {
          id: parentTenant.id,
          name: `${parentTenant.firstName} ${parentTenant.lastName}`.trim(),
          firstName: parentTenant.firstName,
          lastName: parentTenant.lastName,
          type: parentMeta.type || 'Individual',
        };
      }
    }

    // Find any occupants / residents that have this tenant as parentId
    let residents: any[] = [];
    try {
      const occupantTenants = await prisma.tenant.findMany({
        where: {
          emergencyContact: { contains: `"parentId":"${tenant.id}"` },
          isActive: true,
        },
      });
      residents = occupantTenants.map((occ) => ({
        id: occ.id,
        firstName: occ.firstName,
        lastName: occ.lastName,
        email: occ.email.includes('@occupant.internal') ? '' : occ.email,
        phone: occ.phone,
      }));
    } catch {
      residents = [];
    }

    const type = meta.type || 'Individual';
    const isInternalEmail = tenant.email.includes('@occupant.internal');
    const displayEmail = isInternalEmail ? '' : tenant.email;

    return {
      ...tenant,
      name: `${tenant.firstName} ${tenant.lastName}`.trim(),
      email: displayEmail,
      type,
      companyName: meta.companyName || tenant.company?.name || '',
      companyCode: tenant.company?.code || '',
      company: tenant.company,
      parentId: meta.parentId || null,
      parent,
      propertyId: meta.propertyId || null,
      propertyName: meta.propertyName || null,
      unitId: meta.unitId || null,
      unitNumber: meta.unitNumber || null,
      bedroomId: meta.bedroomId || null,
      street: meta.street || '',
      city: meta.city || '',
      state: meta.state || '',
      postalCode: meta.postalCode || '',
      country: meta.country || '',
      companyDetails: meta.companyDetails || '',
      companyContacts: meta.companyContacts || [],
      residents: residents.length > 0 ? residents : (meta.residents || []),
      emergencyContact: meta.emergencyContact || null,
    };
  }

  static async createTenant(
    data: any,
    actorUserId?: string
  ) {
    const type = data.type || 'Individual';
    const companyId = data.companyId;

    // First & Last name resolution
    const firstName = (data.firstName || '').trim() || (type === 'Company' ? (data.companyName || 'Company') : 'Resident');
    const lastName = (data.lastName || '').trim() || (type === 'Company' ? 'Tenant' : 'Occupant');

    // Email resolution (Resident might not provide an email)
    let email = (data.email || '').trim().toLowerCase();
    if (!email) {
      email = `resident_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@occupant.internal`;
    }

    const existing = await prisma.tenant.findUnique({
      where: { email },
    });

    if (existing && existing.isActive) {
      throw new AppError('Tenant with this email already exists', 409, 'DUPLICATE_TENANT_EMAIL');
    }

    const phone = (data.phone || '').trim() || '+10000000000';

    // Store rich metadata in emergencyContact
    const metadata = {
      type,
      companyName: data.companyName || null,
      companyDetails: data.companyDetails || null,
      street: data.street || null,
      city: data.city || null,
      state: data.state || null,
      postalCode: data.postalCode || null,
      country: data.country || null,
      companyContacts: Array.isArray(data.companyContacts) ? data.companyContacts : [],
      parentId: data.parentId || null,
      propertyId: data.propertyId || null,
      propertyName: data.propertyName || null,
      unitId: data.unitId || null,
      unitNumber: data.unitNumber || null,
      bedroomId: data.bedroomId || null,
      residents: Array.isArray(data.residents) ? data.residents : [],
      emergencyContact: data.emergencyContact || null,
    };

    // Filter to ONLY valid Prisma fields for tenant creation
    const tenant = await prisma.tenant.create({
      data: {
        companyId,
        firstName,
        lastName,
        email,
        phone,
        emergencyContact: JSON.stringify(metadata),
      },
      include: {
        company: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'CREATE_TENANT',
      entityType: 'Tenant',
      entityId: tenant.id,
      newData: tenant,
    });

    const isInternalEmail = tenant.email.includes('@occupant.internal');
    return {
      ...tenant,
      ...metadata,
      name: `${tenant.firstName} ${tenant.lastName}`.trim(),
      email: isInternalEmail ? '' : tenant.email,
      companyCode: tenant.company?.code || '',
    };
  }

  static async updateTenant(
    id: string,
    companyId: string | null | undefined,
    data: any,
    actorUserId?: string
  ) {
    const oldTenant = await this.getTenantById(id, companyId);

    // Parse existing meta
    let existingMeta: any = {};
    if (oldTenant.emergencyContact) {
      try {
        existingMeta = JSON.parse(oldTenant.emergencyContact);
      } catch {
        existingMeta = { emergencyContact: oldTenant.emergencyContact };
      }
    }

    const mergedMeta = {
      ...existingMeta,
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
      ...(data.companyDetails !== undefined ? { companyDetails: data.companyDetails } : {}),
      ...(data.street !== undefined ? { street: data.street } : {}),
      ...(data.city !== undefined ? { city: data.city } : {}),
      ...(data.state !== undefined ? { state: data.state } : {}),
      ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
      ...(data.country !== undefined ? { country: data.country } : {}),
      ...(data.companyContacts !== undefined ? { companyContacts: data.companyContacts } : {}),
      ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
      ...(data.propertyId !== undefined ? { propertyId: data.propertyId } : {}),
      ...(data.propertyName !== undefined ? { propertyName: data.propertyName } : {}),
      ...(data.unitId !== undefined ? { unitId: data.unitId } : {}),
      ...(data.unitNumber !== undefined ? { unitNumber: data.unitNumber } : {}),
      ...(data.bedroomId !== undefined ? { bedroomId: data.bedroomId } : {}),
      ...(data.residents !== undefined ? { residents: data.residents } : {}),
      ...(data.emergencyContact !== undefined ? { emergencyContact: data.emergencyContact } : {}),
    };

    const prismaUpdateData: any = {
      emergencyContact: JSON.stringify(mergedMeta),
    };
    if (data.firstName) prismaUpdateData.firstName = data.firstName;
    if (data.lastName) prismaUpdateData.lastName = data.lastName;
    if (data.phone) prismaUpdateData.phone = data.phone;
    if (data.email && !data.email.includes('@occupant.internal')) {
      prismaUpdateData.email = data.email;
    }

    const updated = await prisma.tenant.update({
      where: { id: oldTenant.id },
      data: prismaUpdateData,
      include: {
        company: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_TENANT',
      entityType: 'Tenant',
      entityId: id,
      oldData: oldTenant,
      newData: updated,
    });

    const isInternalEmail = updated.email.includes('@occupant.internal');
    return {
      ...updated,
      ...mergedMeta,
      name: `${updated.firstName} ${updated.lastName}`.trim(),
      email: isInternalEmail ? '' : updated.email,
    };
  }

  static async deleteTenant(id: string, companyId?: string | null, actorUserId?: string) {
    const tenant = await this.getTenantById(id, companyId);

    // 1. Deactivate/terminate active leases
    await prisma.lease.updateMany({
      where: { tenantId: tenant.id },
      data: { status: 'TERMINATED', isActive: false },
    });

    // 2. Soft delete or hard delete tenant
    let deleted;
    try {
      deleted = await prisma.tenant.delete({
        where: { id: tenant.id },
      });
    } catch (e) {
      deleted = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { isActive: false },
      });
    }

    await createAuditLog({
      userId: actorUserId,
      action: 'DELETE_TENANT',
      entityType: 'Tenant',
      entityId: id,
      oldData: tenant,
      newData: deleted,
    });

    return { message: 'Tenant deleted successfully' };
  }

  static async listVehicles(
    companyId?: string | null,
    query?: { search?: string; buildingId?: string; unauthorizedOnly?: string }
  ) {
    const where: any = {};
    if (query?.buildingId && query.buildingId !== 'all') {
      where.unit = {
        propertyId: query.buildingId,
      };
    } else if (companyId) {
      where.tenant = { companyId };
    }

    if (query?.search) {
      const s = query.search;
      where.OR = [
        { licensePlate: { contains: s, mode: 'insensitive' } },
        { make: { contains: s, mode: 'insensitive' } },
        { model: { contains: s, mode: 'insensitive' } },
        { tenant: { firstName: { contains: s, mode: 'insensitive' } } },
        { tenant: { lastName: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            leases: {
              where: { status: 'ACTIVE', isActive: true },
              select: { id: true, endDate: true },
              take: 1,
            },
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = vehicles.map((v) => {
      const activeLease = v.tenant?.leases?.[0];
      const isAuthorized = !!activeLease;
      return {
        id: v.id,
        tenantId: v.tenantId,
        unitId: v.unitId,
        make: v.make,
        model: v.model,
        color: (v as any).color || 'N/A',
        licensePlate: v.licensePlate,
        permitNumber: v.permitNumber,
        parkingSpace: v.permitNumber || 'Assigned',
        createdAt: v.createdAt,
        tenantName: v.tenant ? `${v.tenant.firstName} ${v.tenant.lastName}`.trim() : 'Unknown Tenant',
        tenantPhone: v.tenant?.phone || '',
        buildingName: v.unit?.property?.name || 'Main Building',
        unitNumber: v.unit?.unitNumber || '-',
        isAuthorized,
        leaseExpiry: activeLease?.endDate ? new Date(activeLease.endDate).toLocaleDateString() : 'Expired',
        tenant: v.tenant,
        unit: v.unit,
      };
    });

    if (query?.unauthorizedOnly === 'true') {
      return result.filter((v) => !v.isAuthorized);
    }
    if (query?.unauthorizedOnly === 'false') {
      return result.filter((v) => v.isAuthorized);
    }

    return result;
  }

  static async createVehicle(
    data: {
      tenantId: string;
      unitId?: string;
      make: string;
    model: string;
    color?: string;
    licensePlate: string;
      permitNumber?: string;
    },
    actorUserId?: string
  ) {
    let resolvedUnitId = data.unitId;
    if (!resolvedUnitId && data.tenantId) {
      const activeLease = await prisma.lease.findFirst({
        where: { tenantId: data.tenantId, status: 'ACTIVE', isActive: true },
        select: { unitId: true },
      });
      if (activeLease) {
        resolvedUnitId = activeLease.unitId;
      } else {
        const anyLease = await prisma.lease.findFirst({
          where: { tenantId: data.tenantId },
          select: { unitId: true },
        });
        if (anyLease) {
          resolvedUnitId = anyLease.unitId;
        } else {
          const anyUnit = await prisma.unit.findFirst({ select: { id: true } });
          resolvedUnitId = anyUnit?.id || '';
        }
      }
    }

    if (!resolvedUnitId) {
      throw new AppError('Unit ID is required to register vehicle', 400, 'UNIT_REQUIRED');
    }

    const existing = await prisma.vehicle.findUnique({
      where: { licensePlate: data.licensePlate.toUpperCase() },
    });

    if (existing) {
      throw new AppError('Vehicle with this license plate already registered', 409, 'DUPLICATE_LICENSE_PLATE');
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        tenantId: data.tenantId,
        unitId: resolvedUnitId,
        make: data.make,
        model: data.model,
        color: data.color || null,
        licensePlate: data.licensePlate.toUpperCase(),
        permitNumber: data.permitNumber || null,
      },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'REGISTER_VEHICLE',
      entityType: 'Vehicle',
      entityId: vehicle.id,
      newData: vehicle,
    });

    return {
      ...vehicle,
      tenantName: vehicle.tenant ? `${vehicle.tenant.firstName} ${vehicle.tenant.lastName}`.trim() : '',
      buildingName: vehicle.unit?.property?.name || '',
      unitNumber: vehicle.unit?.unitNumber || '',
      parkingSpace: vehicle.permitNumber || 'Assigned',
      isAuthorized: true,
    };
  }

  static async updateVehicle(
    id: string,
    data: {
      tenantId?: string;
      unitId?: string;
      make?: string;
    model?: string;
    color?: string;
    licensePlate?: string;
      permitNumber?: string;
    },
    actorUserId?: string
  ) {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    if (data.licensePlate && data.licensePlate.toUpperCase() !== existing.licensePlate) {
      const duplicate = await prisma.vehicle.findUnique({
        where: { licensePlate: data.licensePlate.toUpperCase() },
      });
      if (duplicate) {
        throw new AppError('Vehicle with this license plate already registered', 409, 'DUPLICATE_LICENSE_PLATE');
      }
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(data.tenantId ? { tenantId: data.tenantId } : {}),
        ...(data.unitId ? { unitId: data.unitId } : {}),
        ...(data.make ? { make: data.make } : {}),
        ...(data.model ? { model: data.model } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.licensePlate ? { licensePlate: data.licensePlate.toUpperCase() } : {}),
        ...(data.permitNumber !== undefined ? { permitNumber: data.permitNumber } : {}),
      },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_VEHICLE',
      entityType: 'Vehicle',
      entityId: id,
      oldData: existing,
      newData: updated,
    });

    return {
      ...updated,
      tenantName: updated.tenant ? `${updated.tenant.firstName} ${updated.tenant.lastName}`.trim() : '',
      buildingName: updated.unit?.property?.name || '',
      unitNumber: updated.unit?.unitNumber || '',
      parkingSpace: updated.permitNumber || 'Assigned',
      isAuthorized: true,
    };
  }

  static async deleteVehicle(id: string, actorUserId?: string) {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    await prisma.vehicle.delete({ where: { id } });

    await createAuditLog({
      userId: actorUserId,
      action: 'DELETE_VEHICLE',
      entityType: 'Vehicle',
      entityId: id,
      oldData: existing,
    });

    return { success: true, message: 'Vehicle deleted successfully' };
  }
}
