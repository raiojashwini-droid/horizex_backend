import { prisma } from '../../config/db';

export interface CustomQueryParams {
  module: 'Financials' | 'Properties' | 'Leases' | 'TAL Cases' | 'Payroll';
  companyId?: string | null;
  buildingId?: string | null;
  search?: string | null;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc';
}

const DEFAULT_TEMPLATES = [
  {
    id: 'temp-fin-1',
    templateName: 'Unpaid Rent Collections',
    module: 'Financials',
    selectedColumns: ['invoiceNo', 'tenantName', 'buildingName', 'unitNumber', 'dueDate', 'amount', 'balance', 'status'],
    filters: {},
    grouping: 'buildingName',
    sorting: { column: 'dueDate', direction: 'asc' },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'temp-prop-1',
    templateName: 'Vacant Units Overview',
    module: 'Properties',
    selectedColumns: ['buildingName', 'unitNumber', 'unitType', 'monthlyRent', 'status'],
    filters: {},
    grouping: 'buildingName',
    sorting: { column: 'buildingName', direction: 'asc' },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'temp-lease-1',
    templateName: 'Upcoming Lease Renewals',
    module: 'Leases',
    selectedColumns: ['tenantName', 'buildingName', 'unitNumber', 'endDate', 'daysRemaining', 'status'],
    filters: {},
    grouping: 'buildingName',
    sorting: { column: 'endDate', direction: 'asc' },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'temp-tal-1',
    templateName: 'Active Court Litigations',
    module: 'TAL Cases',
    selectedColumns: ['caseNo', 'tenantName', 'buildingName', 'unitNumber', 'category', 'status', 'hearDate'],
    filters: {},
    grouping: 'buildingName',
    sorting: { column: 'caseNo', direction: 'asc' },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'temp-pay-1',
    templateName: 'Monthly Payroll Payouts',
    module: 'Payroll',
    selectedColumns: ['employeeName', 'department', 'grossAmount', 'deductions', 'netAmount', 'payrollMonth'],
    filters: {},
    grouping: 'department',
    sorting: { column: 'grossAmount', direction: 'desc' },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export class ReportsService {
  /**
   * Execute Custom Report Builder query directly against PostgreSQL database using Prisma
   */
  static async executeCustomReportQuery(params: CustomQueryParams) {
    const { module, companyId, buildingId, search, sortColumn, sortDirection = 'asc' } = params;
    let targetCompanyId = companyId && companyId !== 'all' ? companyId : null;
    const cleanBld = buildingId && buildingId !== 'all' ? buildingId : null;

    if (targetCompanyId) {
      try {
        const foundComp = await prisma.company.findFirst({
          where: {
            OR: [
              { id: targetCompanyId },
              { name: targetCompanyId },
            ],
          },
          select: { id: true },
        });
        if (foundComp) {
          targetCompanyId = foundComp.id;
        }
      } catch (err) {
        console.warn('Company resolution note:', err);
      }
    }

    let rows: any[] = [];

    switch (module) {
      case 'Financials': {
        const where: any = {};
        if (targetCompanyId) {
          where.OR = [
            { tenant: { companyId: targetCompanyId } },
            { lease: { unit: { property: { companyId: targetCompanyId } } } },
          ];
        }
        if (cleanBld) {
          where.lease = { unit: { propertyId: cleanBld } };
        }

        const invoices = await prisma.invoice.findMany({
          where,
          include: {
            tenant: true,
            lease: {
              include: {
                unit: {
                  include: {
                    property: true,
                  },
                },
              },
            },
          },
          orderBy: { dueDate: 'desc' },
        });

        rows = invoices.map((inv) => {
          const amount = Number(inv.amountDue || 0);
          const paid = Number(inv.amountPaid || 0);
          const tenantName = inv.tenant ? `${inv.tenant.firstName} ${inv.tenant.lastName}`.trim() : '—';
          const buildingName = inv.lease?.unit?.property?.name || '—';
          const unitNumber = inv.lease?.unit?.unitNumber || '—';
          const dueDate = inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '—';

          return {
            invoiceNo: inv.invoiceNumber || `INV-${inv.id.slice(-6)}`,
            tenantName,
            buildingName,
            unitNumber,
            dueDate,
            amount,
            balance: Math.max(0, amount - paid),
            status: inv.status,
          };
        });
        break;
      }

      case 'Properties': {
        const where: any = {};
        if (targetCompanyId) {
          where.companyId = targetCompanyId;
        }
        if (cleanBld) {
          where.id = cleanBld;
        }

        const properties = await prisma.property.findMany({
          where,
          include: {
            units: {
              include: {
                unitType: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        });

        properties.forEach((p) => {
          if (p.units && p.units.length > 0) {
            p.units.forEach((u) => {
              rows.push({
                buildingName: p.name,
                unitNumber: u.unitNumber,
                unitType: u.unitType?.name || 'Standard Unit',
                monthlyRent: Number(u.baseRent || 0),
                status: u.status,
              });
            });
          } else {
            rows.push({
              buildingName: p.name,
              unitNumber: p.totalUnits ? `${p.totalUnits} Units` : 'Main',
              unitType: 'Commercial/Residential',
              monthlyRent: 0,
              status: p.isActive ? 'ACTIVE' : 'INACTIVE',
            });
          }
        });
        break;
      }

      case 'Leases': {
        const where: any = {};
        if (cleanBld) {
          where.unit = { propertyId: cleanBld };
        } else if (targetCompanyId) {
          where.OR = [
            { unit: { property: { companyId: targetCompanyId } } },
            { tenant: { companyId: targetCompanyId } },
          ];
        }

        const leases = await prisma.lease.findMany({
          where,
          include: {
            tenant: true,
            unit: {
              include: {
                property: true,
              },
            },
          },
          orderBy: { endDate: 'asc' },
        });

        rows = leases.map((l) => {
          const tenantName = l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}`.trim() : '—';
          const buildingName = l.unit?.property?.name || '—';
          const unitNumber = l.unit?.unitNumber || '—';
          const endDate = l.endDate ? new Date(l.endDate).toISOString().split('T')[0] : '—';
          let daysRemaining: number | string = '—';
          if (l.endDate) {
            const diff = Math.ceil((new Date(l.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            daysRemaining = diff > 0 ? `${diff} days` : diff === 0 ? 'Today' : 'Expired';
          }

          return {
            tenantName,
            buildingName,
            unitNumber,
            endDate,
            daysRemaining,
            status: l.status,
          };
        });
        break;
      }

      case 'TAL Cases': {
        const where: any = {};
        if (cleanBld) {
          where.propertyId = cleanBld;
        } else if (targetCompanyId) {
          where.property = { companyId: targetCompanyId };
        }

        const cases = await prisma.talCase.findMany({
          where,
          include: {
            tenant: true,
            property: true,
            unit: true,
            events: {
              orderBy: { eventDate: 'desc' },
              take: 1,
            },
          },
          orderBy: { filingDate: 'desc' },
        });

        rows = cases.map((c) => {
          const tenantName = c.tenant ? `${c.tenant.firstName} ${c.tenant.lastName}`.trim() : '—';
          const buildingName = c.property?.name || '—';
          const unitNumber = c.unit?.unitNumber || '—';
          const category = Number(c.amountClaimed || 0) > 0 ? `Claim $${Number(c.amountClaimed)}` : 'Dispute';
          const hearDate = c.events?.[0]?.eventDate
            ? new Date(c.events[0].eventDate).toISOString().split('T')[0]
            : c.filingDate
            ? new Date(c.filingDate).toISOString().split('T')[0]
            : '—';

          return {
            caseNo: c.docketNumber || `TAL-${c.id.slice(-6)}`,
            tenantName,
            buildingName,
            unitNumber,
            category,
            status: c.status,
            hearDate,
          };
        });
        break;
      }

      case 'Payroll': {
        const where: any = {};
        if (targetCompanyId) {
          where.user = { companyId: targetCompanyId };
        }

        const staffProfiles = await prisma.staffProfile.findMany({
          where,
          include: {
            user: true,
            clockLogs: true,
          },
        });

        const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        rows = staffProfiles.map((s) => {
          const employeeName = s.user ? `${s.user.firstName} ${s.user.lastName}`.trim() : 'Staff Member';
          const hourlyRate = Number(s.hourlyRate || 25);
          const totalHours = s.clockLogs.reduce((sum, cl) => sum + Number(cl.totalHours || 0), 0) || 80;
          const grossAmount = Math.round(hourlyRate * totalHours);
          const deductions = Math.round(grossAmount * 0.18);
          const netAmount = grossAmount - deductions;

          return {
            employeeName,
            department: s.department || 'Operations',
            grossAmount,
            deductions,
            netAmount,
            payrollMonth: currentMonth,
          };
        });
        break;
      }

      default:
        rows = [];
    }

    // Server-side keyword search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((row) =>
        Object.values(row).some((val) => String(val || '').toLowerCase().includes(q))
      );
    }

    // Server-side sorting
    if (sortColumn) {
      rows.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        return sortDirection === 'asc'
          ? String(valA ?? '').localeCompare(String(valB ?? ''))
          : String(valB ?? '').localeCompare(String(valA ?? ''));
      });
    }

    return {
      module,
      totalCount: rows.length,
      data: rows,
    };
  }

  /**
   * Retrieve report templates (Default + Saved in PostgreSQL AuditLog table)
   */
  static async getTemplates(moduleFilter?: string) {
    const savedLogs = await prisma.auditLog.findMany({
      where: {
        action: 'SAVE_REPORT_TEMPLATE',
        entityType: 'ReportTemplate',
      },
      orderBy: { timestamp: 'desc' },
    });

    const savedTemplates: any[] = [];
    const seenIds = new Set<string>();

    savedLogs.forEach((log) => {
      if (log.newData && typeof log.newData === 'object') {
        const t = log.newData as any;
        const id = t.id || log.entityId;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          savedTemplates.push({
            ...t,
            id,
            createdAt: log.timestamp.toISOString(),
          });
        }
      }
    });

    const combined = [...savedTemplates, ...DEFAULT_TEMPLATES.filter((d) => !seenIds.has(d.id))];

    if (moduleFilter) {
      return combined.filter((t) => t.module === moduleFilter);
    }
    return combined;
  }

  /**
   * Save a report template into PostgreSQL AuditLog table
   */
  static async saveTemplate(templateData: any, userId?: string) {
    if (!templateData.templateName || !templateData.module) {
      throw new Error('Template name and module are required.');
    }

    const templateId = templateData.id || `temp-${Date.now()}`;
    const payload = {
      ...templateData,
      id: templateId,
      updatedAt: new Date().toISOString(),
    };

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: 'SAVE_REPORT_TEMPLATE',
        entityType: 'ReportTemplate',
        entityId: templateId,
        newData: payload,
      },
    });

    return payload;
  }

  /**
   * Delete a saved report template from PostgreSQL AuditLog
   */
  static async deleteTemplate(templateId: string) {
    await prisma.auditLog.deleteMany({
      where: {
        entityType: 'ReportTemplate',
        entityId: templateId,
      },
    });
    return { success: true, message: 'Template removed.' };
  }

  /**
   * Log Report Generation in PostgreSQL AuditLog table
   */
  static async logAudit(reportType: string, filtersUsed: any, exportType = 'Screen', userId?: string) {
    return prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: 'REPORT_GENERATION',
        entityType: 'Report',
        entityId: reportType,
        newData: {
          filtersUsed,
          exportType,
          generatedAt: new Date().toISOString(),
        },
      },
      include: {
        user: true,
      },
    });
  }

  /**
   * Fetch Report Generation logs from PostgreSQL
   */
  static async getAuditLogs(limit = 50) {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'REPORT_GENERATION',
        entityType: 'Report',
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: true,
      },
    });

    return logs.map((log) => {
      const details = (log.newData as any) || {};
      const userName = log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : 'Admin User';
      return {
        id: log.id,
        createdAt: log.timestamp.toISOString(),
        generatedBy: userName,
        reportType: log.entityId,
        filtersUsed: details.filtersUsed || {},
        exportType: details.exportType || 'Screen',
      };
    });
  }
}
