import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';

export class PropertiesService {
  static async listProperties(companyId?: string | null, search?: string) {
    const where: any = { isActive: true };
    if (companyId) {
      where.companyId = companyId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const properties = await prisma.property.findMany({
      where,
      include: {
        company: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
        units: {
          where: { isActive: true },
          select: { id: true, status: true, baseRent: true },
        },
        _count: {
          select: {
            units: { where: { isActive: true } },
            tickets: { where: { status: { notIn: ['CLOSED', 'RESOLVED'] } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return properties.map((prop) => {
      const totalUnits = prop.units.length;
      const occupiedUnits = prop.units.filter((u) => u.status === 'OCCUPIED').length;
      const vacantUnits = prop.units.filter((u) => u.status === 'VACANT').length;
      const turnoverUnits = prop.units.filter((u) => u.status === 'TURNOVER').length;
      const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

      return {
        ...prop,
        companyName: prop.company?.name || '',
        ownerNames: prop.owner ? `${prop.owner.firstName} ${prop.owner.lastName}`.trim() : ((prop as any).ownerNames || ''),
        ownerIds: prop.ownerId ? [prop.ownerId] : [],
        street: prop.address,
        province: prop.state,
        units: prop.totalUnits || totalUnits || prop.units.length,
        status: prop.isActive ? 'Active' : 'Inactive',
        unitsList: prop.units,
        analytics: {
          totalUnits: prop.totalUnits || totalUnits || prop.units.length,
          occupiedUnits,
          vacantUnits,
          turnoverUnits,
          occupancyRate: Math.round(occupancyRate * 10) / 10,
        },
      };
    });
  }

  static async getPropertyById(id: string, companyId?: string | null) {
    const where: any = { id, isActive: true };
    if (companyId) {
      where.companyId = companyId;
    }

    const property = await prisma.property.findFirst({
      where,
      include: {
        units: {
          where: { isActive: true },
          include: {
            leases: {
              where: { status: 'ACTIVE', isActive: true },
              include: { tenant: true },
            },
            readiness: true,
          },
        },
        insurance: { where: { isCompliant: true } },
      },
    });

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    return property;
  }

  static async createProperty(
    rawData: any,
    actorUserId?: string
  ) {
    const address =
      rawData.address ||
      [rawData.civicNumber, rawData.street].filter(Boolean).join(' ') ||
      rawData.name ||
      '100 Main St';
    const state = rawData.state || rawData.province || 'Quebec';
    const city = rawData.city || 'Montreal';
    const postalCode = rawData.postalCode || 'H1A 1A1';
    const totalUnits = Number(rawData.totalUnits ?? rawData.units ?? 0) || 0;

    const data: any = {
      companyId: rawData.companyId,
      name: rawData.name,
      address,
      city,
      state,
      postalCode,
      totalUnits,
    };

    const ownerId = rawData.ownerId || (Array.isArray(rawData.ownerIds) && typeof rawData.ownerIds[0] === 'string' && rawData.ownerIds[0].length > 10 ? rawData.ownerIds[0] : undefined);
    if (ownerId) {
      data.ownerId = ownerId;
    }

    const property = await prisma.property.create({ data });

    await createAuditLog({
      userId: actorUserId,
      action: 'CREATE_PROPERTY',
      entityType: 'Property',
      entityId: property.id,
      newData: property,
    });

    return property;
  }

  static async updateProperty(
    id: string,
    companyId: string | null | undefined,
    rawData: any,
    actorUserId?: string
  ) {
    const oldData = await prisma.property.findUnique({
      where: { id },
    });

    if (!oldData) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (companyId && oldData.companyId !== companyId) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    const data: any = {};
    if (rawData.name !== undefined && rawData.name) data.name = String(rawData.name).trim();
    if (rawData.address !== undefined) {
      data.address = rawData.address;
    } else if (rawData.street !== undefined || rawData.civicNumber !== undefined) {
      data.address = [rawData.civicNumber, rawData.street].filter(Boolean).join(' ') || oldData.address;
    }
    if (rawData.city !== undefined) data.city = rawData.city;
    if (rawData.state !== undefined) {
      data.state = rawData.state;
    } else if (rawData.province !== undefined) {
      data.state = rawData.province;
    }
    if (rawData.postalCode !== undefined) data.postalCode = rawData.postalCode;
    if (rawData.totalUnits !== undefined || rawData.units !== undefined) {
      data.totalUnits = Number(rawData.totalUnits ?? rawData.units ?? 0);
    }
    if (rawData.companyId && typeof rawData.companyId === 'string' && rawData.companyId.length > 10) {
      data.companyId = rawData.companyId;
    }
    if (rawData.status !== undefined) {
      data.isActive = rawData.status === 'Active' || rawData.status === true;
    }
    if (rawData.ownerId !== undefined) {
      const oid = typeof rawData.ownerId === 'string' && rawData.ownerId.length > 10 ? rawData.ownerId : null;
      data.ownerId = oid;
    } else if (Array.isArray(rawData.ownerIds)) {
      const oid = (rawData.ownerIds[0] && typeof rawData.ownerIds[0] === 'string' && rawData.ownerIds[0].length > 10) ? rawData.ownerIds[0] : null;
      data.ownerId = oid;
    }

    const updated = await prisma.property.update({
      where: { id: oldData.id },
      data,
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_PROPERTY',
      entityType: 'Property',
      entityId: id,
      oldData,
      newData: updated,
    });

    return updated;
  }

  static async softDeleteProperty(id: string, companyId: string | null | undefined, actorUserId?: string) {
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        units: { select: { id: true } },
      },
    });

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (companyId && property.companyId !== companyId) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    // 1. Terminate any active leases under this property so deletion is not blocked
    const unitIds = property.units.map((u) => u.id);
    if (unitIds.length > 0) {
      await prisma.lease.updateMany({
        where: {
          unitId: { in: unitIds },
          status: 'ACTIVE',
        },
        data: {
          status: 'TERMINATED',
          isActive: false,
        },
      });
    }

    // 2. Deactivate all units under this property
    await prisma.unit.updateMany({
      where: { propertyId: property.id },
      data: { isActive: false },
    });

    // 3. Mark property inactive
    const updated = await prisma.property.update({
      where: { id: property.id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'SOFT_DELETE_PROPERTY',
      entityType: 'Property',
      entityId: id,
      oldData: property,
      newData: updated,
    });

    return { message: 'Property deleted successfully' };
  }
}

