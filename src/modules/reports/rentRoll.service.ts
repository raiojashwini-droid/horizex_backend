import { prisma } from '../../config/db';

export interface RentRollSummary {
  totalUnits: number;
  occupiedUnits: number;
  occupiedBedrooms: number;
  vacantUnits: number;
  vacantBedrooms: number;
  totalActualMonthlyRent: number;
  totalPotentialMonthlyRent: number;
  totalVacancyLoss: number;
  totalOutstandingRent: number;
  totalOutstandingDeposits: number;
}

export interface RentRollRow {
  id: string;
  parentUnitId?: string;
  companyName: string;
  buildingName: string;
  buildingId: string;
  leaseType: string;
  unitNumber: string;
  bedroomNumber: string;
  tenantName: string;
  startDate: string | null;
  endDate: string | null;
  monthlyRent: number;
  grossRent?: number;
  promotionalDiscount?: number;
  potentialRent: number;
  vacancyLoss: number;
  outstandingRent: number;
  outstandingDeposit: number;
  status: string;
  isTemporary?: boolean;
}

export class RentRollService {
  static async getRentRollData(params: {
    companyId?: string | null;
    buildingId?: string | null;
    ownerId?: string | null;
  }): Promise<{ summary: RentRollSummary; rentRoll: RentRollRow[] }> {
    const { companyId, buildingId, ownerId } = params;

    const propWhere: any = { isActive: true };
    if (companyId && companyId !== 'all') {
      propWhere.companyId = companyId;
    }
    if (buildingId && buildingId !== 'all') {
      propWhere.id = buildingId;
    }
    if (ownerId) {
      propWhere.ownerId = ownerId;
    }

    const properties = await prisma.property.findMany({
      where: propWhere,
      include: {
        company: { select: { id: true, name: true } },
        units: {
          where: { isActive: true },
          include: {
            unitType: true,
            leases: {
              where: { status: 'ACTIVE', isActive: true },
              include: {
                tenant: true,
                invoices: {
                  where: { status: { in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] } },
                },
              },
            },
          },
          orderBy: { unitNumber: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Also fetch extended fields via raw query to get rentalMode, bedroomDetails, etc.
    const unitIds = properties.flatMap((p) => p.units.map((u) => u.id));
    let extendedMap = new Map<string, any>();

    // Also fetch invoices with category via raw SQL
    const leaseIds = properties.flatMap((p) => p.units.flatMap((u) => u.leases.map((l) => l.id)));
    let invoiceMap = new Map<string, any[]>();

    if (leaseIds.length > 0) {
      try {
        const rawInvoices: any[] = await prisma.$queryRaw`
          SELECT id, "leaseId", category, "amountDue", "amountPaid", status
          FROM "Invoice"
          WHERE status IN ('UNPAID', 'OVERDUE', 'PARTIALLY_PAID')
        `;
        for (const inv of rawInvoices) {
          if (inv.leaseId) {
            if (!invoiceMap.has(inv.leaseId)) {
              invoiceMap.set(inv.leaseId, []);
            }
            invoiceMap.get(inv.leaseId)!.push(inv);
          }
        }
      } catch (e) {
        console.error('Error fetching invoices for rent roll:', e);
      }
    }

    if (unitIds.length > 0) {
      try {
        const rawExtended: any[] = await prisma.$queryRawUnsafe(`
          SELECT 
            id,
            "rentalMode",
            "isTemporaryAccommodation",
            "temporaryUnitId",
            "potentialRent",
            "promotionalDiscount",
            "reservedFlag",
            "reserveFirstName",
            "reserveLastName",
            "reserveEmail",
            "reservePhone",
            "tentativeMoveInDate",
            "bedroomDetails"
          FROM "Unit"
          WHERE id = ANY($1::text[])
        `, unitIds);
        for (const row of rawExtended) {
          extendedMap.set(row.id, row);
        }
      } catch (e) {
        // Fallback using individual queries if IN clause has parameter issues
        for (const uid of unitIds) {
          try {
            const raw: any[] = await prisma.$queryRaw`
              SELECT 
                id,
                "rentalMode",
                "isTemporaryAccommodation",
                "temporaryUnitId",
                "potentialRent",
                "promotionalDiscount",
                "reservedFlag",
                "reserveFirstName",
                "reserveLastName",
                "reserveEmail",
                "reservePhone",
                "tentativeMoveInDate",
                "bedroomDetails"
              FROM "Unit"
              WHERE id = ${uid}
            `;
            if (raw && raw[0]) {
              extendedMap.set(uid, raw[0]);
            }
          } catch (_) {}
        }
      }
    }

    let totalUnits = 0;
    let occupiedUnits = 0;
    let occupiedBedrooms = 0;
    let vacantUnits = 0;
    let vacantBedrooms = 0;
    let totalActualMonthlyRent = 0;
    let totalPotentialMonthlyRent = 0;
    let totalVacancyLoss = 0;
    let totalOutstandingRent = 0;
    let totalOutstandingDeposits = 0;

    const rows: RentRollRow[] = [];

    for (const prop of properties) {
      const companyName = prop.company?.name || 'Horizex Group';
      const buildingName = prop.name;

      for (const unit of prop.units) {
        totalUnits += 1;
        const ext = extendedMap.get(unit.id) || {};
        const rentalMode = ext.rentalMode || 'FULL_UNIT';
        const isTemp = ext.isTemporaryAccommodation === true;
        const tempRelocatedTo = ext.temporaryUnitId;
        const isReserved = ext.reservedFlag === true;
        const baseRent = Number(unit.baseRent || 0);
        const potentialRent = ext.potentialRent !== null && ext.potentialRent !== undefined
          ? Number(ext.potentialRent)
          : (unit.unitType?.marketRent ? Number(unit.unitType.marketRent) : baseRent);
        const promoDiscount = Number(ext.promotionalDiscount || 0);

        if (rentalMode === 'BEDROOM_WISE') {
          // Bedroom-Wise unit handling
          let bedrooms: any[] = [];
          if (ext.bedroomDetails) {
            try {
              bedrooms = typeof ext.bedroomDetails === 'string'
                ? JSON.parse(ext.bedroomDetails)
                : ext.bedroomDetails;
            } catch (_) {}
          }

          if (!bedrooms || bedrooms.length === 0) {
            const bedCount = unit.bedrooms || 2;
            const perBedRent = Math.round(potentialRent / bedCount);
            bedrooms = Array.from({ length: bedCount }).map((_, i) => ({
              id: `bed-${unit.id}-${i + 1}`,
              bedroomNumber: String(i + 1),
              potentialRent: perBedRent,
              monthlyRent: 0,
              grossRent: perBedRent,
              promotionalDiscount: 0,
              status: 'Vacant',
              tenantName: '-',
              startDate: null,
              endDate: null,
              outstandingRent: 0,
              outstandingDeposit: 0,
            }));
          }

          const hasAnyOccupiedOrReserved = bedrooms.some(
            (b) => b.status === 'Occupied' || b.status === 'Reserved' || (Number(b.monthlyRent || 0) > 0)
          );

          if (!hasAnyOccupiedOrReserved) {
            // Smart aggregation: ALL bedrooms vacant -> collapse into 1 Vacant row
            const combinedVacancy = bedrooms.reduce(
              (sum, b) => sum + Number(b.potentialRent || b.monthlyRent || 0),
              0
            ) || potentialRent;

            vacantUnits += 1;
            vacantBedrooms += bedrooms.length;
            totalPotentialMonthlyRent += combinedVacancy;
            totalVacancyLoss += combinedVacancy;

            rows.push({
              id: `unit-${unit.id}`,
              companyName,
              buildingName,
              buildingId: prop.id,
              leaseType: 'Bedroom Lease',
              unitNumber: unit.unitNumber,
              bedroomNumber: '-',
              tenantName: '-',
              startDate: null,
              endDate: null,
              monthlyRent: 0,
              grossRent: combinedVacancy,
              promotionalDiscount: 0,
              potentialRent: combinedVacancy,
              vacancyLoss: combinedVacancy,
              outstandingRent: 0,
              outstandingDeposit: 0,
              status: 'Vacant',
            });
          } else {
            // Expand into individual bedroom rows
            for (const bed of bedrooms) {
              const isBedOccupied = bed.status === 'Occupied' || Number(bed.monthlyRent || 0) > 0;
              const isBedReserved = bed.status === 'Reserved';
              const bedRent = Number(bed.monthlyRent || 0);
              const bedPotential = Number(bed.potentialRent || bed.grossRent || bedRent);
              const bedGross = Number(bed.grossRent || bedPotential);
              const bedPromo = Number(bed.promotionalDiscount || 0);
              const bedLoss = isBedOccupied || isBedReserved ? 0 : bedPotential;
              const bedOutRent = Number(bed.outstandingRent || 0);
              const bedOutDeposit = Number(bed.outstandingDeposit || 0);

              if (isBedOccupied || isBedReserved) {
                occupiedBedrooms += 1;
                totalActualMonthlyRent += bedRent;
                totalPotentialMonthlyRent += (bedRent > 0 ? bedRent : bedPotential);
              } else {
                vacantBedrooms += 1;
                totalPotentialMonthlyRent += bedPotential;
                totalVacancyLoss += bedLoss;
              }

              totalOutstandingRent += bedOutRent;
              totalOutstandingDeposits += bedOutDeposit;

              rows.push({
                id: `bed-${bed.id || `${unit.id}-${bed.bedroomNumber}`}`,
                parentUnitId: unit.id,
                companyName,
                buildingName,
                buildingId: prop.id,
                leaseType: 'Bedroom Lease',
                unitNumber: unit.unitNumber,
                bedroomNumber: String(bed.bedroomNumber),
                tenantName: bed.tenantName || (isBedOccupied ? 'Resident' : '-'),
                startDate: bed.startDate || null,
                endDate: bed.endDate || null,
                monthlyRent: bedRent,
                grossRent: bedGross,
                promotionalDiscount: bedPromo,
                potentialRent: bedPotential,
                vacancyLoss: bedLoss,
                outstandingRent: bedOutRent,
                outstandingDeposit: bedOutDeposit,
                status: isBedOccupied ? 'Occupied' : (isBedReserved ? 'Reserved' : 'Vacant'),
              });
            }
          }
        } else {
          // FULL_UNIT handling
          const activeLease = unit.leases[0];

          if (isTemp) {
            // Temporary Accommodation unit
            occupiedUnits += 1;
            rows.push({
              id: `unit-${unit.id}`,
              companyName,
              buildingName,
              buildingId: prop.id,
              leaseType: 'Full Unit',
              unitNumber: unit.unitNumber,
              bedroomNumber: '-',
              tenantName: 'Temporary Occupant',
              startDate: null,
              endDate: null,
              monthlyRent: 0,
              grossRent: 0,
              promotionalDiscount: 0,
              potentialRent: 0,
              vacancyLoss: 0,
              outstandingRent: 0,
              outstandingDeposit: 0,
              status: 'Temporarily Occupied',
              isTemporary: true,
            });
          } else if (tempRelocatedTo) {
            // Original unit relocated elsewhere
            rows.push({
              id: `unit-${unit.id}`,
              companyName,
              buildingName,
              buildingId: prop.id,
              leaseType: 'Full Unit',
              unitNumber: unit.unitNumber,
              bedroomNumber: '-',
              tenantName: 'Tenant Relocated',
              startDate: null,
              endDate: null,
              monthlyRent: 0,
              grossRent: 0,
              promotionalDiscount: 0,
              potentialRent: potentialRent,
              vacancyLoss: 0,
              outstandingRent: 0,
              outstandingDeposit: 0,
              status: 'Temporarily elsewhere',
            });
          } else if (activeLease) {
            // Actively Leased Full Unit
            occupiedUnits += 1;
            const actualRent = Number(activeLease.rentAmount || 0);
            totalActualMonthlyRent += actualRent;
            totalPotentialMonthlyRent += actualRent;

            let outRent = 0;
            let outDeposit = 0;

            const invList = invoiceMap.get(activeLease.id) || activeLease.invoices || [];
            for (const inv of invList) {
              const bal = Math.max(0, Number(inv.amountDue) - Number(inv.amountPaid || 0));
              if (inv.category === 'SECURITY_DEPOSIT') {
                outDeposit += bal;
              } else {
                outRent += bal;
              }
            }

            totalOutstandingRent += outRent;
            totalOutstandingDeposits += outDeposit;

            const tName = activeLease.tenant
              ? `${activeLease.tenant.firstName || ''} ${activeLease.tenant.lastName || ''}`.trim()
              : 'Resident';

            rows.push({
              id: `unit-${unit.id}`,
              companyName,
              buildingName,
              buildingId: prop.id,
              leaseType: 'Full Unit',
              unitNumber: unit.unitNumber,
              bedroomNumber: '-',
              tenantName: tName,
              startDate: activeLease.startDate ? new Date(activeLease.startDate).toISOString() : null,
              endDate: activeLease.endDate ? new Date(activeLease.endDate).toISOString() : null,
              monthlyRent: actualRent,
              grossRent: actualRent + promoDiscount,
              promotionalDiscount: promoDiscount,
              potentialRent,
              vacancyLoss: 0,
              outstandingRent: outRent,
              outstandingDeposit: outDeposit,
              status: 'Occupied',
            });
          } else if (isReserved) {
            // Reserved Full Unit
            occupiedUnits += 1;
            totalPotentialMonthlyRent += potentialRent;

            const rName = `${ext.reserveFirstName || ''} ${ext.reserveLastName || ''}`.trim() || 'Reserved Prospect';

            rows.push({
              id: `unit-${unit.id}`,
              companyName,
              buildingName,
              buildingId: prop.id,
              leaseType: 'Full Unit',
              unitNumber: unit.unitNumber,
              bedroomNumber: '-',
              tenantName: rName,
              startDate: ext.tentativeMoveInDate ? new Date(ext.tentativeMoveInDate).toISOString() : null,
              endDate: null,
              monthlyRent: potentialRent,
              grossRent: potentialRent,
              promotionalDiscount: 0,
              potentialRent,
              vacancyLoss: 0,
              outstandingRent: 0,
              outstandingDeposit: 0,
              status: 'Reserved',
            });
          } else {
            // Completely Vacant Full Unit
            vacantUnits += 1;
            totalPotentialMonthlyRent += potentialRent;
            totalVacancyLoss += potentialRent;

            rows.push({
              id: `unit-${unit.id}`,
              companyName,
              buildingName,
              buildingId: prop.id,
              leaseType: 'Full Unit',
              unitNumber: unit.unitNumber,
              bedroomNumber: '-',
              tenantName: '-',
              startDate: null,
              endDate: null,
              monthlyRent: 0,
              grossRent: potentialRent,
              promotionalDiscount: 0,
              potentialRent,
              vacancyLoss: potentialRent,
              outstandingRent: 0,
              outstandingDeposit: 0,
              status: 'Vacant',
            });
          }
        }
      }
    }

    const summary: RentRollSummary = {
      totalUnits,
      occupiedUnits,
      occupiedBedrooms,
      vacantUnits,
      vacantBedrooms,
      totalActualMonthlyRent,
      totalPotentialMonthlyRent,
      totalVacancyLoss,
      totalOutstandingRent,
      totalOutstandingDeposits,
    };

    return { summary, rentRoll: rows };
  }

  static async updatePotentialRent(params: {
    id: string;
    type?: string;
    potentialRent: number;
  }): Promise<boolean> {
    const { id, type, potentialRent } = params;

    const parts = (id || '').split('-');
    const kind = type || parts[0];
    const realId = parts.length > 1 ? parts.slice(1).join('-') : id;

    if (kind === 'bed') {
      // Update specific bedroom in bedroomDetails
      // Find which unit contains this bedroom
      const unitsWithBeds: any[] = await prisma.$queryRaw`
        SELECT id, "bedroomDetails" FROM "Unit" WHERE "bedroomDetails" IS NOT NULL
      `;

      for (const u of unitsWithBeds) {
        let beds: any[] = [];
        try {
          beds = typeof u.bedroomDetails === 'string' ? JSON.parse(u.bedroomDetails) : u.bedroomDetails;
        } catch (_) {}

        const match = beds.find((b) => b.id === id || b.id === realId);
        if (match) {
          match.potentialRent = potentialRent;
          match.grossRent = potentialRent;
          await prisma.$executeRawUnsafe(`
            UPDATE "Unit" SET "bedroomDetails" = $1::jsonb WHERE id = $2
          `, JSON.stringify(beds), u.id);
          return true;
        }
      }
    }

    // Otherwise update unit potentialRent
    const unitId = kind === 'unit' ? realId : id;
    await prisma.$executeRawUnsafe(`
      UPDATE "Unit" SET "potentialRent" = $1 WHERE id = $2
    `, potentialRent, unitId);
    return true;
  }
}
