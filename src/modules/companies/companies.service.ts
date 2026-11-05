import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';

export class CompaniesService {
  static async listCompanies(userCompanyId?: string | null, isSuperAdmin = false) {
    const where: any = { isActive: true };
    if (!isSuperAdmin && userCompanyId) {
      where.id = userCompanyId;
    }

    return prisma.company.findMany({
      where,
      include: {
        _count: {
          select: {
            properties: { where: { isActive: true } },
            users: { where: { isActive: true } },
            tenants: { where: { isActive: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getCompanyById(id: string) {
    const company = await prisma.company.findFirst({
      where: { id, isActive: true },
      include: {
        properties: { where: { isActive: true } },
        bankAccounts: { where: { isActive: true } },
      },
    });

    if (!company) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    return company;
  }

  static async createCompany(
    data: { name: string; code: string; contactEmail?: string; contactPhone?: string; taxNumber?: string },
    actorUserId?: string
  ) {
    const existing = await prisma.company.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new AppError('Company code is already taken', 409, 'DUPLICATE_COMPANY_CODE');
    }

    const email = data.contactEmail || `info@${data.code.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com`;

    const company = await prisma.company.create({
      data: {
        name: data.name,
        code: data.code,
        contactEmail: email,
        contactPhone: data.contactPhone,
        taxNumber: data.taxNumber,
      },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'CREATE_COMPANY',
      entityType: 'Company',
      entityId: company.id,
      newData: company,
    });

    return company;
  }

  static async updateCompany(
    id: string,
    data: { name?: string; contactEmail?: string; contactPhone?: string; taxNumber?: string },
    actorUserId?: string
  ) {
    const oldData = await this.getCompanyById(id);

    const updated = await prisma.company.update({
      where: { id },
      data,
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'UPDATE_COMPANY',
      entityType: 'Company',
      entityId: id,
      oldData,
      newData: updated,
    });

    return updated;
  }

  static async softDeleteCompany(id: string, actorUserId?: string) {
    const oldData = await this.getCompanyById(id);

    const updated = await prisma.company.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: actorUserId,
      action: 'SOFT_DELETE_COMPANY',
      entityType: 'Company',
      entityId: id,
      oldData,
      newData: updated,
    });

    return { message: 'Company deactivated successfully' };
  }
}

