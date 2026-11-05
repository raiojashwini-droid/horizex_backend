import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';

export class TalCasesService {
  static async listCases(companyId?: string | null) {
    const where: any = {};
    if (companyId) {
      where.property = { companyId };
    }

    return prisma.talCase.findMany({
      where,
      include: {
        property: { select: { id: true, name: true, address: true } },
        unit: { select: { id: true, unitNumber: true } },
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
        events: {
          where: { isCompleted: false },
          orderBy: { eventDate: 'asc' },
          take: 1,
        },
      },
      orderBy: { filingDate: 'desc' },
    });
  }

  static async getCaseById(id: string, companyId?: string | null) {
    const where: any = { id };
    if (companyId) {
      where.property = { companyId };
    }

    const talCase = await prisma.talCase.findFirst({
      where,
      include: {
        property: true,
        unit: true,
        tenant: true,
        events: { orderBy: { eventDate: 'asc' } },
      },
    });

    if (!talCase) {
      throw new AppError('TAL legal case dossier not found', 404, 'TAL_CASE_NOT_FOUND');
    }

    return talCase;
  }

  static async createCase(
    data: {
      propertyId: string;
      unitId: string;
      tenantId: string;
      docketNumber: string;
      filingDate: string;
      amountClaimed: number;
      evidenceUrls?: string[];
    },
    companyId?: string | null,
    actorUserId?: string
  ) {
    const existing = await prisma.talCase.findUnique({
      where: { docketNumber: data.docketNumber },
    });

    if (existing) {
      throw new AppError('A TAL legal case with this docket number already exists', 409, 'DUPLICATE_DOCKET');
    }

    const property = await prisma.property.findFirst({
      where: {
        id: data.propertyId,
        isActive: true,
        ...(companyId ? { companyId } : {}),
      },
    });

    if (!property) {
      throw new AppError('Property not found or access denied', 404, 'PROPERTY_NOT_FOUND');
    }

    const talCase = await prisma.talCase.create({
      data: {
        propertyId: data.propertyId,
        unitId: data.unitId,
        tenantId: data.tenantId,
        docketNumber: data.docketNumber,
        filingDate: new Date(data.filingDate),
        amountClaimed: data.amountClaimed,
        evidenceUrls: data.evidenceUrls ?? [],
        status: 'FILED',
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'FILE_TAL_CASE',
      entityType: 'TalCase',
      entityId: talCase.id,
      newData: talCase,
    });

    return talCase;
  }

  static async scheduleHearing(
    caseId: string,
    companyId: string | null | undefined,
    data: {
      eventDate: string;
      eventType?: string;
      description: string;
    },
    actorUserId?: string
  ) {
    const talCase = await this.getCaseById(caseId, companyId);

    const event = await prisma.caseEvent.create({
      data: {
        caseId: talCase.id,
        eventDate: new Date(data.eventDate),
        eventType: data.eventType ?? 'HEARING',
        description: data.description,
      },
    });

    // Update TAL case status if hearing scheduled
    await prisma.talCase.update({
      where: { id: talCase.id },
      data: { status: 'HEARING_SCHEDULED' },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'SCHEDULE_TAL_HEARING',
      entityType: 'CaseEvent',
      entityId: event.id,
      newData: event,
    });

    return event;
  }
}

