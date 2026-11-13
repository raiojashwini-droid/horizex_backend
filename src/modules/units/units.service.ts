import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';

export class UnitsService {
  static async listUnits(filters: {
    companyId?: string | null;
    propertyId?: string;
    status?: any;
    bedrooms?: number;
    minRent?: number;
    maxRent?: number;
    showInactive?: boolean;
    search?: string;
    unitType?: string;
  }) {
    const where: any = { isActive: true };

    if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'undefined' && filters.propertyId !== 'null' && String(filters.propertyId).trim() !== '') {
      where.propertyId = String(filters.propertyId).trim();
    } else if (filters.companyId && filters.companyId !== 'all' && filters.companyId !== 'undefined' && filters.companyId !== 'null' && String(filters.companyId).trim() !== '') {
      where.property = { companyId: String(filters.companyId).trim() };
    }

    if (filters.status && filters.status !== 'all') {
      const s = String(filters.status).toUpperCase();
      if (['VACANT', 'OCCUPIED', 'TURNOVER', 'MAINTENANCE'].includes(s)) {
        where.status = s;
      }
    }

    if (filters.bedrooms !== undefined && !isNaN(Number(filters.bedrooms))) {
      where.bedrooms = Number(filters.bedrooms);
    }

    if (filters.minRent !== undefined || filters.maxRent !== undefined) {
      where.baseRent = {};
      if (filters.minRent !== undefined && !isNaN(Number(filters.minRent))) where.baseRent.gte = Number(filters.minRent);
      if (filters.maxRent !== undefined && !isNaN(Number(filters.maxRent))) where.baseRent.lte = Number(filters.maxRent);
    }

    const units = await prisma.unit.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            company: { select: { id: true, name: true } },
          },
        },
        unitType: { select: { id: true, name: true, code: true } },
        leases: {
          where: { status: 'ACTIVE', isActive: true },
          include: { tenant: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        },
        readiness: true,
      },
      orderBy: [{ propertyId: 'asc' }, { unitNumber: 'asc' }],
    });

    const result = units.map((u) => {
      const activeLease = u.leases?.[0];
      let meta: any = {};
      try {
        meta = JSON.parse(u.readiness?.notes || '{}');
      } catch {}
      const classification = meta.classification ||
        (u.readiness?.stage === 'MAINTENANCE_REPAIRS' ? 'New Construction' : 'Completed');
      const unit_status = meta.unit_status ||
        (classification === 'New Construction' ? 'INACTIVE' : 'ACTIVE');
      const reserved_flag = u.reservedFlag || meta.reserved_flag || false;
      const gc_delivered_target_date = meta.gc_delivered_target_date || null;

      return {
        ...u,
        classification,
        unit_status,
        reserved_flag,
        gc_delivered_target_date,
        companyName: u.property?.company?.name || '',
        buildingName: u.property?.name || '',
        building: u.property?.name || '',
        unitTypeName: u.unitType?.name || '',
        unitType: u.unitType?.name || '',
        unitTypeObj: u.unitType,
        activeLease: activeLease
          ? {
              id: activeLease.id,
              tenantName: activeLease.tenant
                ? `${activeLease.tenant.firstName} ${activeLease.tenant.lastName}`
                : 'Leased',
            }
          : null,
      };
    });

    if (filters.showInactive === false) {
      return result.filter((u: any) => u.unit_status !== 'INACTIVE' && u.classification !== 'New Construction');
    }

    return result;
  }

  static async getVacantBedrooms(unitId?: string, companyId?: string | null, includeId?: string) {
    const where: any = { isActive: true };
    if (unitId) {
      where.id = unitId;
    }
    if (companyId) {
      where.property = { companyId };
    }

    const units = await prisma.unit.findMany({
      where,
      include: {
        readiness: true,
        leases: {
          where: { status: 'ACTIVE', isActive: true },
        },
      },
    });

    const allBedrooms: any[] = [];

    for (const unit of units) {
      const count = Math.max(1, Number(unit.bedrooms) || 1);
      let meta: any = {};
      try {
        meta = JSON.parse(unit.readiness?.notes || '{}');
      } catch {}

      const identifiers: string[] = Array.isArray(meta.bedroomIdentifiers) ? meta.bedroomIdentifiers : [];

      for (let i = 0; i < count; i++) {
        const bedId = i + 1;
        const bedName = identifiers[i] || `${unit.unitNumber}-${i + 1}`;
        allBedrooms.push({
          id: bedId,
          bedroomId: bedId,
          bedroomNumber: bedName,
          displayName: bedName,
          roomNumber: bedName,
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          status: 'VACANT',
        });
      }
    }

    return allBedrooms;
  }

  static async getUnitById(id: string, companyId?: string | null) {
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        property: {
          include: { company: { select: { id: true, name: true } } },
        },
        unitType: true,
        readiness: true,
        leases: {
          where: { isActive: true },
          include: { tenant: true },
          orderBy: { startDate: 'desc' },
        },
        tickets: {
          orderBy: { createdAt: 'desc' },
        },
        vehicles: true,
        moveInspections: {
          orderBy: { inspectionDate: 'desc' },
        },
      },
    });

    if (!unit) {
      throw new AppError('Unit not found', 404, 'UNIT_NOT_FOUND');
    }

    if (companyId && unit.property?.companyId !== companyId) {
      throw new AppError('Unit not found or access denied', 404, 'UNIT_NOT_FOUND');
    }

    const activeLease = unit.leases?.[0];
    let meta: any = {};
    try {
      meta = JSON.parse(unit.readiness?.notes || '{}');
    } catch {}
    const classification = meta.classification ||
      (unit.readiness?.stage === 'MAINTENANCE_REPAIRS' ? 'New Construction' : 'Completed');
    const unit_status = meta.unit_status ||
      (classification === 'New Construction' ? 'INACTIVE' : 'ACTIVE');

    const count = Math.max(1, Number(unit.bedrooms) || 1);
    const identifiers: string[] = Array.isArray(unit.bedroomDetails)
      ? (unit.bedroomDetails as string[])
      : (Array.isArray(meta.bedroomIdentifiers) ? meta.bedroomIdentifiers : []);
    const bedroomsList = [];
    for (let i = 0; i < count; i++) {
      const name = identifiers[i] || `${unit.unitNumber}-${i + 1}`;
      bedroomsList.push({
        id: i + 1,
        bedroomNumber: name,
        displayName: name,
        roomNumber: name,
        unitId: unit.id,
      });
    }

    return {
      ...unit,
      classification,
      unit_status,
      reserved_flag: unit.reservedFlag || meta.reserved_flag || false,
      gc_delivered_target_date: meta.gc_delivered_target_date || null,
      reserve_firstName: unit.reserveFirstName || meta.reserve_firstName || '',
      reserve_lastName: unit.reserveLastName || meta.reserve_lastName || '',
      reserve_email: unit.reserveEmail || meta.reserve_email || '',
      reserve_phone: unit.reservePhone || meta.reserve_phone || '',
      tentative_move_in_date: unit.tentativeMoveInDate || meta.tentative_move_in_date || null,
      bedroomIdentifiers: identifiers,
      bedroomsList,
      companyName: (unit.property as any)?.company?.name || '',
      buildingName: unit.property?.name || '',
      building: unit.property?.name || '',
      unitTypeName: unit.unitType?.name || '',
      unitType: unit.unitType?.name || '',
      unitTypeObj: unit.unitType,
      activeLease: activeLease
        ? {
            id: activeLease.id,
            tenantName: activeLease.tenant
              ? `${activeLease.tenant.firstName} ${activeLease.tenant.lastName}`
              : 'Leased',
          }
        : null,
    };
  }

  static async createUnit(
    data: {
      propertyId: string;
      unitTypeId?: string | null;
      unitType?: string | null;
      unitNumber: string;
      floor?: number | null;
      bedrooms?: number;
      bathrooms?: number;
      squareFeet?: number | null;
      baseRent?: number;
      status?: string;
      [key: string]: any;
    },
    companyId?: string | null,
    actorUserId?: string
  ) {
    // Validate property exists
    const property = await prisma.property.findUnique({
      where: { id: data.propertyId },
    });

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (companyId && property.companyId !== companyId) {
      throw new AppError('Property not found or access denied', 403, 'PROPERTY_ACCESS_DENIED');
    }

    const cleanUnitNumber = String(data.unitNumber || '').trim();
    if (!cleanUnitNumber) {
      throw new AppError('Unit number is required', 400, 'UNIT_NUMBER_REQUIRED');
    }

    const existing = await prisma.unit.findUnique({
      where: {
        propertyId_unitNumber: {
          propertyId: data.propertyId,
          unitNumber: cleanUnitNumber,
        },
      },
    });

    if (existing && existing.isActive) {
      throw new AppError(
        `Unit number ${cleanUnitNumber} already exists in this property`,
        409,
        'DUPLICATE_UNIT_NUMBER'
      );
    }

    let unitTypeId = data.unitTypeId || null;
    let baseRent = data.baseRent ? Number(data.baseRent) : undefined;

    // Resolve unitTypeId if type name was sent from frontend
    if (!unitTypeId && data.unitType) {
      const typeRecord = await prisma.unitType.findFirst({
        where: {
          OR: [
            { name: { equals: data.unitType, mode: 'insensitive' } },
            { code: { equals: data.unitType, mode: 'insensitive' } },
          ],
        },
      });
      if (typeRecord) {
        unitTypeId = typeRecord.id;
        if (!baseRent) {
          baseRent = Number(typeRecord.marketRent);
        }
      }
    }

    if (!baseRent || isNaN(baseRent)) {
      baseRent = 1200;
    }

    const unitStatus =
      data.status === 'Occupied' || data.status === 'OCCUPIED'
        ? 'OCCUPIED'
        : data.status === 'TURNOVER'
        ? 'TURNOVER'
        : data.status === 'MAINTENANCE'
        ? 'MAINTENANCE'
        : 'VACANT';

    const bedroomIdentifiers = Array.isArray(data.bedroomIdentifiers) ? data.bedroomIdentifiers : [];

    const notesMeta = {
      classification: data.classification || (data.unit_status === 'INACTIVE' ? 'New Construction' : 'Completed'),
      unit_status: data.unit_status || (data.classification === 'New Construction' ? 'INACTIVE' : 'ACTIVE'),
      gc_delivered_target_date: data.gc_delivered_target_date || null,
      reserved_flag: !!data.reserved_flag,
      reserved_by_id: data.reserved_by_id || null,
      reserve_firstName: data.reserve_firstName || '',
      reserve_lastName: data.reserve_lastName || '',
      reserve_email: data.reserve_email || '',
      reserve_phone: data.reserve_phone || '',
      tentative_move_in_date: data.tentative_move_in_date || null,
      bedroomIdentifiers,
    };

    let unit;
    if (existing && !existing.isActive) {
      // Reactivate previously soft-deleted unit
      unit = await prisma.unit.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          unitTypeId: unitTypeId,
          floor: Number(data.floor) || 1,
          bedrooms: Number(data.bedrooms) || 1,
          bathrooms: Number(data.bathrooms) || 1.0,
          squareFeet: data.squareFeet ? Number(data.squareFeet) : null,
          baseRent: baseRent,
          status: unitStatus,
          rentalMode: data.rentalMode || 'FULL_UNIT',
          reservedFlag: !!data.reserved_flag,
          reserveFirstName: data.reserve_firstName || null,
          reserveLastName: data.reserve_lastName || null,
          reserveEmail: data.reserve_email || null,
          reservePhone: data.reserve_phone || null,
          tentativeMoveInDate: data.tentative_move_in_date ? new Date(data.tentative_move_in_date) : null,
          bedroomDetails: bedroomIdentifiers,
        },
        include: { readiness: true, property: true, unitType: true },
      });

      await prisma.unitReadiness.upsert({
        where: { unitId: unit.id },
        create: {
          unitId: unit.id,
          stage: data.classification === 'New Construction' ? 'MAINTENANCE_REPAIRS' : 'READY_TO_LEASE',
          cleaningComplete: data.classification !== 'New Construction',
          paintComplete: data.classification !== 'New Construction',
          repairComplete: data.classification !== 'New Construction',
          notes: JSON.stringify(notesMeta),
        },
        update: {
          stage: data.classification === 'New Construction' ? 'MAINTENANCE_REPAIRS' : 'READY_TO_LEASE',
          cleaningComplete: data.classification !== 'New Construction',
          paintComplete: data.classification !== 'New Construction',
          repairComplete: data.classification !== 'New Construction',
          notes: JSON.stringify(notesMeta),
        },
      });
    } else {
      unit = await prisma.unit.create({
        data: {
          propertyId: data.propertyId,
          unitTypeId: unitTypeId,
          unitNumber: cleanUnitNumber,
          floor: Number(data.floor) || 1,
          bedrooms: Number(data.bedrooms) || 1,
          bathrooms: Number(data.bathrooms) || 1.0,
          squareFeet: data.squareFeet ? Number(data.squareFeet) : null,
          baseRent: baseRent,
          status: unitStatus,
          rentalMode: data.rentalMode || 'FULL_UNIT',
          reservedFlag: !!data.reserved_flag,
          reserveFirstName: data.reserve_firstName || null,
          reserveLastName: data.reserve_lastName || null,
          reserveEmail: data.reserve_email || null,
          reservePhone: data.reserve_phone || null,
          tentativeMoveInDate: data.tentative_move_in_date ? new Date(data.tentative_move_in_date) : null,
          bedroomDetails: bedroomIdentifiers,
          readiness: {
            create: {
              stage: data.classification === 'New Construction' ? 'MAINTENANCE_REPAIRS' : 'READY_TO_LEASE',
              cleaningComplete: data.classification !== 'New Construction',
              paintComplete: data.classification !== 'New Construction',
              repairComplete: data.classification !== 'New Construction',
              notes: JSON.stringify(notesMeta),
            },
          },
        },
        include: { readiness: true, property: true, unitType: true },
      });
    }

    // Increment property totalUnits count
    try {
      await prisma.property.update({
        where: { id: data.propertyId },
        data: { totalUnits: { increment: 1 } },
      });
    } catch (e) {}

    await createAuditLog({
      userId: actorUserId,
      action: 'CREATE_UNIT',
      entityType: 'Unit',
      entityId: unit.id,
      newData: unit,
    });

    return unit;
  }

  static async updateUnit(
    id: string,
    companyId: string | null | undefined,
    data: any,
    actorUserId?: string
  ) {
    const oldUnit = await prisma.unit.findUnique({
      where: { id },
      include: {
        property: { include: { company: { select: { id: true, name: true } } } },
        unitType: true,
        readiness: true,
      },
    });

    if (!oldUnit) {
      throw new AppError('Unit not found', 404, 'UNIT_NOT_FOUND');
    }

    if (companyId && oldUnit.property?.companyId !== companyId) {
      throw new AppError('Unit not found or access denied', 404, 'UNIT_NOT_FOUND');
    }

    // 1. Resolve unitTypeId if a string name was passed or unitTypeId provided
    let unitTypeId = data.unitTypeId;
    if (unitTypeId === undefined && data.unitType) {
      if (typeof data.unitType === 'string') {
        const foundType = await prisma.unitType.findFirst({
          where: {
            OR: [
              { name: { equals: data.unitType, mode: 'insensitive' } },
              { code: { equals: data.unitType, mode: 'insensitive' } },
            ],
          },
        });
        if (foundType) {
          unitTypeId = foundType.id;
        }
      } else if (data.unitType && typeof data.unitType === 'object' && data.unitType.id) {
        unitTypeId = data.unitType.id;
      }
    }

    // 2. Normalize status enum
    let unitStatus: any = undefined;
    if (data.status) {
      const s = String(data.status).toUpperCase();
      if (['VACANT', 'OCCUPIED', 'TURNOVER', 'RESERVED', 'MAINTENANCE'].includes(s)) {
        unitStatus = s;
      }
    }

    // 3. Prepare clean data for Prisma
    const updateData: any = {};
    if (data.unitNumber !== undefined && data.unitNumber) {
      updateData.unitNumber = String(data.unitNumber).trim();
    }
    if (unitTypeId !== undefined) updateData.unitTypeId = unitTypeId;
    if (data.floor !== undefined) updateData.floor = data.floor !== null ? Number(data.floor) : null;
    if (data.bedrooms !== undefined) updateData.bedrooms = Number(data.bedrooms);
    if (data.bathrooms !== undefined) updateData.bathrooms = Number(data.bathrooms);
    if (data.squareFeet !== undefined) updateData.squareFeet = data.squareFeet !== null ? Number(data.squareFeet) : null;
    if (data.baseRent !== undefined) updateData.baseRent = Number(data.baseRent);
    if (unitStatus !== undefined) updateData.status = unitStatus;
    if (data.propertyId !== undefined && data.propertyId && data.propertyId !== oldUnit.propertyId) {
      updateData.propertyId = data.propertyId;
    }
    if (data.rentalMode !== undefined) updateData.rentalMode = data.rentalMode;
    if (data.reserved_flag !== undefined) updateData.reservedFlag = Boolean(data.reserved_flag);
    if (data.reserve_firstName !== undefined) updateData.reserveFirstName = data.reserve_firstName || null;
    if (data.reserve_lastName !== undefined) updateData.reserveLastName = data.reserve_lastName || null;
    if (data.reserve_email !== undefined) updateData.reserveEmail = data.reserve_email || null;
    if (data.reserve_phone !== undefined) updateData.reservePhone = data.reserve_phone || null;
    if (data.tentative_move_in_date !== undefined) updateData.tentativeMoveInDate = data.tentative_move_in_date ? new Date(data.tentative_move_in_date) : null;
    if (Array.isArray(data.bedroomIdentifiers)) updateData.bedroomDetails = data.bedroomIdentifiers;

    const updated = await prisma.unit.update({
      where: { id: oldUnit.id },
      data: updateData,
      include: {
        property: { include: { company: { select: { id: true, name: true } } } },
        unitType: true,
        readiness: true,
      },
    });

    let currentMeta: any = {};
    try {
      currentMeta = JSON.parse(oldUnit.readiness?.notes || '{}');
    } catch {}
    const newMeta = {
      ...currentMeta,
      ...(data.classification ? { classification: data.classification } : {}),
      ...(data.unit_status ? { unit_status: data.unit_status } : {}),
      ...(data.gc_delivered_target_date !== undefined ? { gc_delivered_target_date: data.gc_delivered_target_date } : {}),
      ...(data.reserved_flag !== undefined ? { reserved_flag: data.reserved_flag } : {}),
      ...(data.reserved_by_id !== undefined ? { reserved_by_id: data.reserved_by_id } : {}),
      ...(data.reserve_firstName !== undefined ? { reserve_firstName: data.reserve_firstName } : {}),
      ...(data.reserve_lastName !== undefined ? { reserve_lastName: data.reserve_lastName } : {}),
      ...(data.reserve_email !== undefined ? { reserve_email: data.reserve_email } : {}),
      ...(data.reserve_phone !== undefined ? { reserve_phone: data.reserve_phone } : {}),
      ...(data.tentative_move_in_date !== undefined ? { tentative_move_in_date: data.tentative_move_in_date } : {}),
      ...(Array.isArray(data.bedroomIdentifiers) ? { bedroomIdentifiers: data.bedroomIdentifiers } : {}),
    };

    await prisma.unitReadiness.upsert({
      where: { unitId: oldUnit.id },
      create: {
        unitId: oldUnit.id,
        stage: data.classification === 'New Construction' ? 'MAINTENANCE_REPAIRS' : 'READY_TO_LEASE',
        notes: JSON.stringify(newMeta),
      },
      update: {
        notes: JSON.stringify(newMeta),
        ...(data.classification === 'New Construction' ? { stage: 'MAINTENANCE_REPAIRS' } : {}),
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_UNIT',
      entityType: 'Unit',
      entityId: id,
      oldData: oldUnit,
      newData: updated,
    });

    const finalClassification = data.classification ||
      (oldUnit as any).classification ||
      (data.unit_status === 'INACTIVE' ? 'New Construction' : 'Completed');
    const finalUnitStatus = data.unit_status ||
      (oldUnit as any).unit_status ||
      (finalClassification === 'New Construction' ? 'INACTIVE' : 'ACTIVE');

    return {
      ...updated,
      classification: finalClassification,
      unit_status: finalUnitStatus,
      companyName: (updated.property as any)?.company?.name || '',
      buildingName: updated.property?.name || '',
      building: updated.property?.name || '',
      unitTypeName: updated.unitType?.name || '',
      unitType: updated.unitType?.name || '',
    };
  }

  static async deleteUnit(id: string, companyId?: string | null, actorUserId?: string) {
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        property: true,
        leases: true,
      },
    });

    if (!unit) {
      throw new AppError('Unit not found', 404, 'UNIT_NOT_FOUND');
    }

    if (companyId && unit.property?.companyId !== companyId) {
      throw new AppError('Unit not found or access denied', 404, 'UNIT_NOT_FOUND');
    }

    // 1. Terminate/deactivate active leases for this unit
    await prisma.lease.updateMany({
      where: { unitId: unit.id },
      data: { status: 'TERMINATED', isActive: false },
    });

    // 2. Decrement property totalUnits
    try {
      await prisma.property.update({
        where: { id: unit.propertyId },
        data: { totalUnits: { decrement: 1 } },
      });
    } catch (e) {}

    // 3. Delete or soft delete unit
    let deleted;
    try {
      deleted = await prisma.unit.delete({
        where: { id: unit.id },
      });
    } catch (e) {
      deleted = await prisma.unit.update({
        where: { id: unit.id },
        data: { isActive: false },
      });
    }

    await createAuditLog({
      userId: actorUserId,
      action: 'DELETE_UNIT',
      entityType: 'Unit',
      entityId: id,
      oldData: unit,
      newData: deleted,
    });

    return { message: 'Unit deleted successfully' };
  }

  static async getReadinessDashboard(companyId?: string | null) {
    const where: any = {
      isActive: true,
      status: 'TURNOVER',
    };
    if (companyId) {
      where.property = { companyId };
    }

    const unitsInTurnover = await prisma.unit.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
        readiness: true,
        tickets: {
          where: { status: { notIn: ['CLOSED', 'RESOLVED'] } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Group units into Kanban stages
    const stages: Record<string, any[]> = {
      NOTICE_GIVEN: [],
      MOVE_OUT_INSPECTION: [],
      TRASH_OUT: [],
      MAINTENANCE_REPAIRS: [],
      PAINTING: [],
      DEEP_CLEANING: [],
      FINAL_INSPECTION: [],
      READY_TO_LEASE: [],
    };

    for (const unit of unitsInTurnover) {
      const stage = unit.readiness?.stage || 'NOTICE_GIVEN';
      if (stages[stage]) {
        stages[stage].push(unit);
      }
    }

    return {
      totalInTurnover: unitsInTurnover.length,
      stages,
    };
  }

  static async updateUnitReadiness(
    unitId: string,
    companyId: string | null | undefined,
    data: {
      stage?: any;
      assignedWorker?: string;
      turnoverDeadline?: string;
      cleaningComplete?: boolean;
      paintComplete?: boolean;
      repairComplete?: boolean;
      notes?: string;
    },
    actorUserId?: string
  ) {
    const unit = await this.getUnitById(unitId, companyId);

    // GATEKEEPER BUSINESS RULE:
    // If attempting to mark READY_TO_LEASE, verify no open repair tickets exist
    if (data.stage === 'READY_TO_LEASE') {
      const openTicketsCount = await prisma.maintenanceTicket.count({
        where: {
          unitId: unit.id,
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
      });

      if (openTicketsCount > 0) {
        throw new AppError(
          `Cannot mark unit READY_TO_LEASE. There are ${openTicketsCount} open maintenance tickets pending resolution.`,
          400,
          'OPEN_REPAIRS_EXIST'
        );
      }
    }

    const updatedReadiness = await prisma.unitReadiness.upsert({
      where: { unitId: unit.id },
      update: {
        stage: data.stage,
        assignedWorker: data.assignedWorker,
        turnoverDeadline: data.turnoverDeadline ? new Date(data.turnoverDeadline) : undefined,
        cleaningComplete: data.cleaningComplete,
        paintComplete: data.paintComplete,
        repairComplete: data.repairComplete,
        notes: data.notes,
      },
      create: {
        unitId: unit.id,
        stage: data.stage ?? 'NOTICE_GIVEN',
        assignedWorker: data.assignedWorker,
        turnoverDeadline: data.turnoverDeadline ? new Date(data.turnoverDeadline) : undefined,
        cleaningComplete: data.cleaningComplete ?? false,
        paintComplete: data.paintComplete ?? false,
        repairComplete: data.repairComplete ?? false,
        notes: data.notes,
      },
    });

    // When marked READY_TO_LEASE, unit automatically transitions back to VACANT
    if (data.stage === 'READY_TO_LEASE') {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { status: 'VACANT' },
      });
    }

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_UNIT_READINESS',
      entityType: 'UnitReadiness',
      entityId: updatedReadiness.id,
      oldData: unit.readiness,
      newData: updatedReadiness,
    });

    return updatedReadiness;
  }

  static async getReadinessBuildings(companyId?: string | null) {
    const where: any = { isActive: true };
    if (companyId) where.companyId = companyId;
    return prisma.property.findMany({
      where,
      select: { id: true, name: true, address: true, totalUnits: true },
      orderBy: { name: 'asc' },
    });
  }

  static async getReadinessStats(companyId?: string | null) {
    const where: any = { isActive: true };
    if (companyId) where.property = { companyId };

    const [totalTurnover, readyToLease, inProgress] = await Promise.all([
      prisma.unit.count({ where: { ...where, status: 'TURNOVER' } }),
      prisma.unit.count({ where: { ...where, readiness: { stage: 'READY_TO_LEASE' } } }),
      prisma.unit.count({
        where: { ...where, status: 'TURNOVER', readiness: { stage: { not: 'READY_TO_LEASE' } } },
      }),
    ]);

    return {
      totalTurnover,
      readyToLease,
      inProgress,
    };
  }
}

