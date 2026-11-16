import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';

const DATA_DIR = path.join(__dirname, '../../../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'readiness_settings.json');
const HOLIDAYS_FILE = path.join(DATA_DIR, 'readiness_holidays.json');

export const DEFAULT_TIMELINE_SETTINGS = [
  { id: 1, key: 'gc_to_deficiencies', days: 2 },
  { id: 2, key: 'deficiencies_to_cleaned', days: 2 },
  { id: 3, key: 'cleaned_to_ffe', days: 4 },
  { id: 4, key: 'ffe_to_final', days: 3 },
  { id: 5, key: 'final_to_ose', days: 1 },
  { id: 6, key: 'ose_to_ready', days: 2 }
];

function getReadinessSettingsData(): any[] {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_TIMELINE_SETTINGS;
}

function saveReadinessSettingsData(settings: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving readiness settings:', err);
  }
}

function getReadinessHolidaysData(): any[] {
  try {
    if (fs.existsSync(HOLIDAYS_FILE)) {
      const content = fs.readFileSync(HOLIDAYS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveReadinessHolidaysData(holidays: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HOLIDAYS_FILE, JSON.stringify(holidays, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving readiness holidays:', err);
  }
}

export function calculateTimelineDates(baseDateStr: string, settings: any[] = DEFAULT_TIMELINE_SETTINGS) {
  const baseDate = new Date(String(baseDateStr).substring(0, 10) + 'T12:00:00');
  if (isNaN(baseDate.getTime())) return {};

  const getDays = (k: string, def: number) => {
    const s = settings.find((item: any) => item.key === k);
    return s && !isNaN(Number(s.days)) ? Number(s.days) : def;
  };

  const dates: Record<string, string> = {};
  dates.gc_delivered = baseDate.toISOString().split('T')[0];

  let curr = new Date(baseDate);
  curr = new Date(curr.getTime() + getDays('gc_to_deficiencies', 2) * 86400000);
  dates.gc_deficiencies = curr.toISOString().split('T')[0];

  curr = new Date(curr.getTime() + getDays('deficiencies_to_cleaned', 2) * 86400000);
  dates.gc_cleaned = curr.toISOString().split('T')[0];

  curr = new Date(curr.getTime() + getDays('cleaned_to_ffe', 4) * 86400000);
  dates.ffe_installed = curr.toISOString().split('T')[0];

  curr = new Date(curr.getTime() + getDays('ffe_to_final', 3) * 86400000);
  dates.final_cleaning = curr.toISOString().split('T')[0];

  curr = new Date(curr.getTime() + getDays('final_to_ose', 1) * 86400000);
  dates.ose_installed = curr.toISOString().split('T')[0];

  curr = new Date(curr.getTime() + getDays('ose_to_ready', 2) * 86400000);
  dates.unit_ready = curr.toISOString().split('T')[0];

  return dates;
}

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

      // If unit already has an active full-unit lease, all bedrooms are occupied
      const hasFullUnitLease = (unit.leases || []).some(
        (l: any) => !l.bedroomId && (l.status === 'ACTIVE' || l.status === 'Active') && l.id !== includeId
      );
      if (hasFullUnitLease) {
        continue;
      }

      const activeBedrooms = new Set(
        (unit.leases || [])
          .filter((l: any) => l.bedroomId && l.id !== includeId)
          .map((l: any) => String(l.bedroomId))
      );

      for (let i = 0; i < count; i++) {
        const bedId = i + 1;
        if (activeBedrooms.has(String(bedId))) {
          continue; // Skip already occupied bedroom
        }
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

    const stepKeys = ['gc_delivered', 'gc_deficiencies', 'gc_cleaned', 'ffe_installed', 'final_cleaning', 'ose_installed', 'unit_ready'];
    const stepFields: Record<string, any> = {};
    stepKeys.forEach(k => {
      stepFields[`${k}_completed`] = Boolean(meta.completion?.[k] || meta[`${k}_completed`]);
      stepFields[`${k}_target_date`] = meta.targetDates?.[k] || meta[`${k}_target_date`] || (k === 'gc_delivered' ? meta.gc_delivered_target_date : null) || null;
      stepFields[`${k}_completed_date`] = meta.completionDates?.[k] || meta[`${k}_completed_date`] || null;
    });

    return {
      ...unit,
      ...stepFields,
      completion: meta.completion || {},
      targetDates: meta.targetDates || {},
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

  static async getReadinessDashboard(companyId?: string | null, query?: any) {
    const search = typeof query?.search === 'string' ? query.search.trim() : '';
    const statusFilter = typeof query?.status === 'string' ? query.status.trim() : '';
    const propertyId = typeof query?.propertyId === 'string' && query.propertyId !== 'all' && query.propertyId !== 'undefined' && query.propertyId !== 'null' ? query.propertyId.trim() : '';
    const showLeased = String(query?.showLeased) === 'true';
    const page = Math.max(1, parseInt(String(query?.page)) || 1);
    const limit = Math.max(1, parseInt(String(query?.limit)) || 15);

    const where: any = {};
    if (companyId && companyId !== 'all') {
      where.property = { companyId };
    }
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Unless showLeased is true, only show vacant/turnover units or units without active lease
    if (!showLeased) {
      where.OR = [
        { status: { in: ['VACANT', 'TURNOVER'] } },
        { leases: { none: { status: 'ACTIVE', isActive: true } } },
      ];
    }

    if (search) {
      const searchCondition = {
        OR: [
          { unitNumber: { contains: search, mode: 'insensitive' as const } },
          { property: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      };
      where.AND = where.AND ? [...where.AND, searchCondition] : [searchCondition];
    }

    const units = await prisma.unit.findMany({
      where,
      include: {
        property: { select: { id: true, name: true, companyId: true } },
        unitType: { select: { id: true, name: true, code: true } },
        readiness: true,
        leases: {
          where: { status: 'ACTIVE', isActive: true },
          include: { tenant: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        },
        tickets: {
          where: { status: { notIn: ['CLOSED', 'RESOLVED'] } },
        },
      },
      orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stepKeys = ['gc_delivered', 'gc_deficiencies', 'gc_cleaned', 'ffe_installed', 'final_cleaning', 'ose_installed', 'unit_ready'];

    let mappedUnits = units.map((u) => {
      let meta: any = {};
      try {
        meta = JSON.parse(u.readiness?.notes || '{}');
      } catch {}

      const completion: Record<string, boolean> = {
        gc_delivered: Boolean(meta.completion?.gc_delivered || meta.gc_delivered_completed),
        gc_deficiencies: Boolean(meta.completion?.gc_deficiencies || meta.gc_deficiencies_completed),
        gc_cleaned: Boolean(meta.completion?.gc_cleaned || meta.gc_cleaned_completed),
        ffe_installed: Boolean(meta.completion?.ffe_installed || meta.ffe_installed_completed),
        final_cleaning: Boolean(meta.completion?.final_cleaning || meta.final_cleaning_completed),
        ose_installed: Boolean(meta.completion?.ose_installed || meta.ose_installed_completed),
        unit_ready: Boolean(meta.completion?.unit_ready || meta.unit_ready_completed || u.readiness?.stage === 'READY_TO_LEASE'),
      };

      const targetDates: Record<string, string | null> = {
        gc_delivered: meta.targetDates?.gc_delivered || meta.gc_delivered_target_date || null,
        gc_deficiencies: meta.targetDates?.gc_deficiencies || null,
        gc_cleaned: meta.targetDates?.gc_cleaned || null,
        ffe_installed: meta.targetDates?.ffe_installed || null,
        final_cleaning: meta.targetDates?.final_cleaning || null,
        ose_installed: meta.targetDates?.ose_installed || null,
        unit_ready: meta.targetDates?.unit_ready || null,
      };

      let daysLate = 0;
      for (const k of stepKeys) {
        if (!completion[k] && targetDates[k]) {
          const tDate = new Date(String(targetDates[k]).substring(0, 10) + 'T12:00:00');
          if (tDate < today) {
            const diffDays = Math.ceil((today.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > daysLate) daysLate = diffDays;
          }
        }
      }

      const vacantSince = u.updatedAt ? new Date(u.updatedAt) : new Date(u.createdAt);
      const marketAge = Math.max(0, Math.floor((today.getTime() - vacantSince.getTime()) / (1000 * 60 * 60 * 24)));

      const reserved = Boolean(u.reservedFlag || meta.reserved_flag);
      const reservedBy = [u.reserveFirstName, u.reserveLastName].filter(Boolean).join(' ').trim() || meta.reserve_name || (reserved ? 'Reserved' : '');
      const moveInDate = u.tentativeMoveInDate
        ? u.tentativeMoveInDate.toISOString().split('T')[0]
        : (meta.tentative_move_in_date || (u.leases?.[0]?.startDate ? u.leases[0].startDate.toISOString().split('T')[0] : null));

      const hasActiveLease = u.leases && u.leases.length > 0;

      return {
        id: u.id,
        building: u.property?.name || 'Unknown',
        buildingId: u.propertyId,
        unitNumber: u.unitNumber,
        unitType: u.unitType?.name || 'Standard',
        status: u.status,
        isActive: u.isActive,
        isPriority: Boolean(meta.isPriority || meta.priority),
        reserved,
        reservedBy,
        stage: u.readiness?.stage || meta.stage || 'NOTICE_GIVEN',
        completion,
        targetDates,
        daysLate,
        moveInDate,
        marketAge,
        marketAgeLabel: 'days',
        hasActiveLease,
        openTickets: u.tickets?.length || 0,
      };
    });

    if (statusFilter) {
      if (statusFilter === 'Occupied') {
        mappedUnits = mappedUnits.filter((u) => u.hasActiveLease || u.status === 'OCCUPIED');
      } else if (statusFilter === 'Available') {
        mappedUnits = mappedUnits.filter((u) => !u.hasActiveLease && !u.reserved && u.status !== 'OCCUPIED');
      } else if (statusFilter === 'Reserved') {
        mappedUnits = mappedUnits.filter((u) => u.reserved);
      } else if (statusFilter === 'INACTIVE') {
        mappedUnits = mappedUnits.filter((u) => !u.isActive);
      } else if (statusFilter === 'ACTIVE') {
        mappedUnits = mappedUnits.filter((u) => u.isActive);
      }
    }

    const total = mappedUnits.length;
    const startIndex = (page - 1) * limit;
    const paginatedUnits = mappedUnits.slice(startIndex, startIndex + limit);

    // Keep backwards compatibility for Kanban stages
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
    for (const u of mappedUnits) {
      if (stages[u.stage]) {
        stages[u.stage].push(u);
      }
    }

    return {
      units: paginatedUnits,
      total,
      page,
      limit,
      totalInTurnover: total,
      stages,
    };
  }

  static async updateUnitReadiness(
    unitId: string,
    companyId: string | null | undefined,
    data: any,
    actorUserId?: string
  ) {
    const unit = await this.getUnitById(unitId, companyId);
    let meta: any = {};
    try {
      meta = JSON.parse(unit.readiness?.notes || '{}');
    } catch {}

    meta.completion = meta.completion || {};
    meta.targetDates = meta.targetDates || {};
    meta.completionDates = meta.completionDates || {};
    meta.manualDates = meta.manualDates || {};

    let targetStage = data.stage || unit.readiness?.stage || 'NOTICE_GIVEN';

    if (data.stepKey) {
      const stepKey = data.stepKey;
      if (data.targetDate !== undefined) {
        meta.targetDates[stepKey] = data.targetDate;
        meta[`${stepKey}_target_date`] = data.targetDate;
        if (data.isManual) {
          meta.manualDates[stepKey] = true;
        }
        if (stepKey === 'gc_delivered') {
          meta.gc_delivered_target_date = data.targetDate;
        }
      }

      if (data.completed !== undefined) {
        const isDone = Boolean(data.completed);
        meta.completion[stepKey] = isDone;
        meta[`${stepKey}_completed`] = isDone;
        const nowIso = isDone ? new Date().toISOString() : null;
        meta.completionDates[stepKey] = nowIso;
        meta[`${stepKey}_completed_date`] = nowIso;

        if (stepKey === 'unit_ready' && isDone) {
          targetStage = 'READY_TO_LEASE';
        } else if (stepKey === 'gc_delivered' && isDone && targetStage === 'NOTICE_GIVEN') {
          targetStage = 'MAINTENANCE_REPAIRS';
        }
      }

      if (data.recalculate) {
        const baseDate = meta.targetDates.gc_delivered || meta.gc_delivered_target_date || new Date().toISOString().split('T')[0];
        const projected = calculateTimelineDates(baseDate, getReadinessSettingsData());
        const otherSteps = ['gc_deficiencies', 'gc_cleaned', 'ffe_installed', 'final_cleaning', 'ose_installed', 'unit_ready'];
        for (const k of otherSteps) {
          if (data.force || !meta.manualDates[k]) {
            meta.targetDates[k] = projected[k];
            meta[`${k}_target_date`] = projected[k];
          }
        }
      }
    }

    if (data.notes && typeof data.notes === 'string' && data.notes.startsWith('{')) {
      try {
        const incomingNotes = JSON.parse(data.notes);
        meta = { ...meta, ...incomingNotes };
      } catch {}
    }

    // Gatekeeper rule:
    if (targetStage === 'READY_TO_LEASE') {
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
        stage: targetStage,
        assignedWorker: data.assignedWorker !== undefined ? data.assignedWorker : undefined,
        turnoverDeadline: data.turnoverDeadline ? new Date(data.turnoverDeadline) : undefined,
        cleaningComplete: data.cleaningComplete !== undefined ? data.cleaningComplete : undefined,
        paintComplete: data.paintComplete !== undefined ? data.paintComplete : undefined,
        repairComplete: data.repairComplete !== undefined ? data.repairComplete : undefined,
        notes: JSON.stringify(meta),
      },
      create: {
        unitId: unit.id,
        stage: targetStage,
        assignedWorker: data.assignedWorker,
        turnoverDeadline: data.turnoverDeadline ? new Date(data.turnoverDeadline) : undefined,
        cleaningComplete: data.cleaningComplete ?? false,
        paintComplete: data.paintComplete ?? false,
        repairComplete: data.repairComplete ?? false,
        notes: JSON.stringify(meta),
      },
    });

    if (targetStage === 'READY_TO_LEASE') {
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

    return {
      ...updatedReadiness,
      completion: meta.completion,
      targetDates: meta.targetDates,
      meta,
    };
  }

  static async getReadinessBuildings(companyId?: string | null) {
    const where: any = { isActive: true };
    if (companyId && companyId !== 'all') where.companyId = companyId;
    return prisma.property.findMany({
      where,
      select: { id: true, name: true, address: true, totalUnits: true },
      orderBy: { name: 'asc' },
    });
  }

  static async getReadinessStats(companyId?: string | null, query?: any) {
    const propertyId = typeof query?.propertyId === 'string' && query.propertyId !== 'all' && query.propertyId !== 'undefined' && query.propertyId !== 'null' ? query.propertyId.trim() : '';
    const showLeased = String(query?.showLeased) === 'true';

    const where: any = {};
    if (companyId && companyId !== 'all') where.property = { companyId };
    if (propertyId) where.propertyId = propertyId;
    if (!showLeased) {
      where.OR = [
        { status: { in: ['VACANT', 'TURNOVER'] } },
        { leases: { none: { status: 'ACTIVE', isActive: true } } },
      ];
    }

    const units = await prisma.unit.findMany({
      where,
      include: {
        property: true,
        readiness: true,
        leases: { where: { status: 'ACTIVE', isActive: true } },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let readyForLeasing = 0;
    let reservedUnits = 0;
    let overdueUnits = 0;

    const stepKeys = ['gc_delivered', 'gc_deficiencies', 'gc_cleaned', 'ffe_installed', 'final_cleaning', 'ose_installed', 'unit_ready'];

    for (const u of units) {
      let meta: any = {};
      try { meta = JSON.parse(u.readiness?.notes || '{}'); } catch {}

      const isReserved = Boolean(u.reservedFlag || meta.reserved_flag);
      if (isReserved) reservedUnits++;

      const isReady = Boolean(
        meta.completion?.unit_ready ||
        meta.unit_ready_completed ||
        u.readiness?.stage === 'READY_TO_LEASE'
      );
      if (isReady) readyForLeasing++;

      let isOverdue = false;
      for (const k of stepKeys) {
        const isDone = Boolean(meta.completion?.[k] || meta[`${k}_completed`]);
        const tDateStr = meta.targetDates?.[k] || meta[`${k}_target_date`] || (k === 'gc_delivered' ? meta.gc_delivered_target_date : null);
        if (!isDone && tDateStr) {
          const tDate = new Date(String(tDateStr).substring(0, 10) + 'T12:00:00');
          if (tDate < today) {
            isOverdue = true;
            break;
          }
        }
      }
      if (isOverdue) overdueUnits++;
    }

    return {
      totalUnits: units.length,
      readyForLeasing,
      reservedUnits,
      overdueUnits,
      totalTurnover: units.length,
      readyToLease: readyForLeasing,
      inProgress: units.length - readyForLeasing,
    };
  }

  static async getReadinessSettings() {
    return getReadinessSettingsData();
  }

  static async updateReadinessSettings(settings: any[], triggerRecalculate = false, companyId?: string | null) {
    if (Array.isArray(settings)) {
      saveReadinessSettingsData(settings);
    }
    if (triggerRecalculate) {
      const units = await prisma.unit.findMany({
        where: { isActive: true, ...(companyId && companyId !== 'all' ? { property: { companyId } } : {}) },
        include: { readiness: true },
      });
      for (const u of units) {
        let meta: any = {};
        try { meta = JSON.parse(u.readiness?.notes || '{}'); } catch {}
        const base = meta.targetDates?.gc_delivered || meta.gc_delivered_target_date;
        if (base) {
          const proj = calculateTimelineDates(base, settings);
          meta.targetDates = meta.targetDates || {};
          meta.manualDates = meta.manualDates || {};
          for (const k of ['gc_deficiencies', 'gc_cleaned', 'ffe_installed', 'final_cleaning', 'ose_installed', 'unit_ready']) {
            if (!meta.manualDates[k]) {
              meta.targetDates[k] = proj[k];
              meta[`${k}_target_date`] = proj[k];
            }
          }
          await prisma.unitReadiness.upsert({
            where: { unitId: u.id },
            update: { notes: JSON.stringify(meta) },
            create: { unitId: u.id, notes: JSON.stringify(meta) },
          });
        }
      }
    }
    return getReadinessSettingsData();
  }

  static async getReadinessHolidays() {
    return getReadinessHolidaysData();
  }

  static async addReadinessHoliday(holiday: { name: string; date: string }) {
    const holidays = getReadinessHolidaysData();
    const newHoliday = {
      id: Buffer.from(Date.now().toString()).toString('base64').substring(0, 8),
      name: holiday.name,
      date: holiday.date,
    };
    holidays.push(newHoliday);
    saveReadinessHolidaysData(holidays);
    return newHoliday;
  }

  static async deleteReadinessHoliday(id: string) {
    let holidays = getReadinessHolidaysData();
    holidays = holidays.filter((h: any) => h.id !== id);
    saveReadinessHolidaysData(holidays);
    return { success: true };
  }

  static async activateUnit(unitId: string, ready: boolean, companyId?: string | null) {
    const unit = await this.getUnitById(unitId, companyId);
    let meta: any = {};
    try { meta = JSON.parse(unit.readiness?.notes || '{}'); } catch {}
    meta.unit_status = ready ? 'ACTIVE' : 'INACTIVE';

    await prisma.unit.update({
      where: { id: unit.id },
      data: { isActive: ready },
    });

    await prisma.unitReadiness.upsert({
      where: { unitId: unit.id },
      update: { notes: JSON.stringify(meta) },
      create: { unitId: unit.id, notes: JSON.stringify(meta) },
    });

    return { success: true, isActive: ready };
  }
}

