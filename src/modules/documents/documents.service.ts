import { prisma } from '../../config/db';

export interface DocumentRow {
  id: string;
  name: string;
  type: string;
  fileUrl: string | null;
  fileSize: string | null;
  size?: string | null;
  mimeType: string | null;
  expiryDate: string | null;
  companyId: string | null;
  propertyId: string | null;
  unitId: string | null;
  userId: string | null;
  leaseId: string | null;
  links: Array<{ entityType: string; entityId: string }>;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
  property?: { id: string; name: string; civicNumber?: string } | null;
  unit?: { id: string; unitNumber: string; name?: string } | null;
  lease?: { id: string; tenant?: { name?: string; firstName?: string; lastName?: string } } | null;
}

export class DocumentsService {
  static async listDocuments(params: {
    companyId?: string | null;
    search?: string;
    type?: string;
  }): Promise<DocumentRow[]> {
    const { companyId, search, type } = params;

    let query = `
      SELECT 
        d.id, d.name, d.type, d."fileUrl", d."fileSize", d."mimeType", d."expiryDate",
        d."companyId", d."propertyId", d."unitId", d."userId", d."leaseId", d."links",
        d."createdAt", d."updatedAt",
        COALESCE(t."firstName", u."firstName") as "userFirstName",
        COALESCE(t."lastName", u."lastName") as "userLastName",
        COALESCE(t.email, u.email) as "userEmail",
        p.name as "propertyName",
        un."unitNumber" as "unitNumber"
      FROM "Document" d
      LEFT JOIN "Tenant" t ON d."userId" = t.id
      LEFT JOIN "User" u ON d."userId" = u.id
      LEFT JOIN "Property" p ON d."propertyId" = p.id
      LEFT JOIN "Unit" un ON d."unitId" = un.id
      WHERE d."isActive" = TRUE
    `;

    if (companyId && companyId !== 'all') {
      query += ` AND (d."companyId" = '${companyId}' OR p."companyId" = '${companyId}' OR d."companyId" IS NULL)`;
    }

    if (type && type !== 'All') {
      query += ` AND d.type = '${type}'`;
    }

    query += ` ORDER BY d."createdAt" DESC`;

    const rawDocs: any[] = await prisma.$queryRawUnsafe(query);

    return rawDocs.map((r) => {
      let links: any[] = [];
      try {
        links = typeof r.links === 'string' ? JSON.parse(r.links) : (r.links || []);
      } catch (e) {
        links = [];
      }

      return {
        id: r.id,
        name: r.name,
        type: r.type,
        fileUrl: r.fileUrl,
        fileSize: r.fileSize || '1.2 MB',
        size: r.fileSize || '1.2 MB',
        mimeType: r.mimeType || 'application/pdf',
        expiryDate: r.expiryDate ? new Date(r.expiryDate).toISOString() : null,
        companyId: r.companyId,
        propertyId: r.propertyId,
        unitId: r.unitId,
        userId: r.userId,
        leaseId: r.leaseId,
        links,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
        user: r.userFirstName ? {
          id: r.userId,
          firstName: r.userFirstName,
          lastName: r.userLastName || '',
          email: r.userEmail || ''
        } : null,
        property: r.propertyName ? {
          id: r.propertyId,
          name: r.propertyName
        } : null,
        unit: r.unitNumber ? {
          id: r.unitId,
          unitNumber: r.unitNumber,
          name: `Unit ${r.unitNumber}`
        } : null,
        lease: r.leaseId ? {
          id: r.leaseId,
          tenant: r.userFirstName ? {
            name: `${r.userFirstName} ${r.userLastName || ''}`.trim()
          } : undefined
        } : null
      };
    });
  }

  static async createDocument(data: {
    name: string;
    type: string;
    expiryDate?: string | null;
    links?: Array<{ entityType: string; entityId: string }>;
    fileUrl?: string | null;
    fileSize?: string | null;
    mimeType?: string | null;
    companyId?: string | null;
  }) {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const links = data.links || [];

    let propertyId: string | null = null;
    let unitId: string | null = null;
    let userId: string | null = null;
    let leaseId: string | null = null;

    links.forEach((l) => {
      if (l.entityType === 'PROPERTY') propertyId = l.entityId;
      if (l.entityType === 'UNIT') unitId = l.entityId;
      if (l.entityType === 'USER') userId = l.entityId;
      if (l.entityType === 'LEASE') leaseId = l.entityId;
    });

    const expiry = data.expiryDate ? new Date(data.expiryDate) : null;

    await prisma.$executeRawUnsafe(`
      INSERT INTO "Document" ("id", "name", "type", "fileUrl", "fileSize", "mimeType", "expiryDate", "companyId", "propertyId", "unitId", "userId", "leaseId", "links", "isActive")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, TRUE)
    `,
      id,
      data.name,
      data.type || 'Other',
      data.fileUrl || `/api/admin/documents/${id}/download`,
      data.fileSize || '1.0 MB',
      data.mimeType || 'application/pdf',
      expiry,
      data.companyId || null,
      propertyId,
      unitId,
      userId,
      leaseId,
      JSON.stringify(links)
    );

    return { id, name: data.name, type: data.type, success: true };
  }

  static async updateDocument(id: string, data: {
    name?: string;
    type?: string;
    expiryDate?: string | null;
    links?: Array<{ entityType: string; entityId: string }>;
  }) {
    const links = data.links || [];

    let propertyId: string | null = null;
    let unitId: string | null = null;
    let userId: string | null = null;
    let leaseId: string | null = null;

    links.forEach((l) => {
      if (l.entityType === 'PROPERTY') propertyId = l.entityId;
      if (l.entityType === 'UNIT') unitId = l.entityId;
      if (l.entityType === 'USER') userId = l.entityId;
      if (l.entityType === 'LEASE') leaseId = l.entityId;
    });

    const expiry = data.expiryDate ? new Date(data.expiryDate) : null;

    await prisma.$executeRawUnsafe(`
      UPDATE "Document"
      SET 
        "name" = COALESCE($2, "name"),
        "type" = COALESCE($3, "type"),
        "expiryDate" = $4,
        "propertyId" = COALESCE($5, "propertyId"),
        "unitId" = COALESCE($6, "unitId"),
        "userId" = COALESCE($7, "userId"),
        "leaseId" = COALESCE($8, "leaseId"),
        "links" = $9::jsonb,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
      id,
      data.name || null,
      data.type || null,
      expiry,
      propertyId,
      unitId,
      userId,
      leaseId,
      JSON.stringify(links)
    );

    return { id, success: true };
  }

  static async deleteDocument(id: string) {
    await prisma.$executeRawUnsafe(`
      UPDATE "Document" SET "isActive" = FALSE WHERE "id" = $1
    `, id);
    return { id, success: true };
  }

  static async getDocumentById(id: string) {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Document" WHERE "id" = $1
    `, id);
    return rows[0] || null;
  }
}
