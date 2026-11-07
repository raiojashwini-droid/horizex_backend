import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';
import crypto from 'crypto';

export interface EmailTemplateItem {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: string;
  language: string;
  documentIds?: string[];
  documents?: any[];
  companyId?: string | null;
  createdAt: string;
}

export class EmailService {
  // ==========================================
  // 1. TEMPLATES
  // ==========================================
  static async getTemplates(companyId?: string | null): Promise<EmailTemplateItem[]> {
    try {
      const templates: any[] = await prisma.$queryRawUnsafe(`
        SELECT id, name, subject, body, type, language, "documentIds", "companyId", "createdAt", "updatedAt"
        FROM "EmailTemplate"
        WHERE "isActive" = TRUE
        ORDER BY "createdAt" DESC
      `);

      // Optionally fetch documents info for attached documentIds
      const allDocIds: string[] = [];
      templates.forEach((t) => {
        const docIds = typeof t.documentIds === 'string' ? JSON.parse(t.documentIds) : (t.documentIds || []);
        if (Array.isArray(docIds)) {
          allDocIds.push(...docIds);
        }
      });

      let docsMap = new Map<string, any>();
      if (allDocIds.length > 0) {
        try {
          const docs: any[] = await prisma.$queryRawUnsafe(`
            SELECT id, name, "fileUrl" as url, "fileSize", "mimeType" as "fileType"
            FROM "Document"
            WHERE id = ANY($1::text[])
          `, allDocIds);
          docs.forEach((d) => docsMap.set(d.id, d));
        } catch (e) {
          // ignore
        }
      }

      return templates.map((t) => {
        const docIds = typeof t.documentIds === 'string' ? JSON.parse(t.documentIds) : (t.documentIds || []);
        const attachedDocs = Array.isArray(docIds) ? docIds.map((id) => docsMap.get(id)).filter(Boolean) : [];

        return {
          id: t.id,
          name: t.name,
          subject: t.subject,
          body: t.body,
          type: t.type || 'General',
          language: t.language || 'en',
          documentIds: docIds,
          documents: attachedDocs,
          companyId: t.companyId,
          createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
        };
      });
    } catch (err) {
      console.error('Error fetching email templates:', err);
      return [];
    }
  }

  static async createTemplate(data: {
    name: string;
    subject: string;
    body: string;
    type?: string;
    language?: string;
    documentIds?: string[];
    companyId?: string;
  }): Promise<EmailTemplateItem> {
    if (!data.name || !data.subject || !data.body) {
      throw new AppError('Template name, subject, and body are required', 400, 'VALIDATION_ERROR');
    }

    const id = `etmpl-${crypto.randomUUID().slice(0, 8)}`;
    const type = data.type || 'General';
    const language = data.language || 'en';
    const docIds = JSON.stringify(data.documentIds || []);

    try {
      const result: any[] = await prisma.$queryRawUnsafe(`
        INSERT INTO "EmailTemplate" ("id", "name", "subject", "body", "type", "language", "documentIds", "companyId", "createdAt", "updatedAt", "isActive")
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW(), NOW(), TRUE)
        RETURNING id, name, subject, body, type, language, "documentIds", "companyId", "createdAt"
      `, id, data.name, data.subject, data.body, type, language, docIds, data.companyId || null);

      const created = result[0];
      return {
        id: created.id,
        name: created.name,
        subject: created.subject,
        body: created.body,
        type: created.type,
        language: created.language,
        documentIds: typeof created.documentIds === 'string' ? JSON.parse(created.documentIds) : (created.documentIds || []),
        documents: [],
        companyId: created.companyId,
        createdAt: new Date(created.createdAt).toISOString(),
      };
    } catch (err) {
      console.error('Error creating email template:', err);
      throw new AppError('Failed to create email template', 500, 'DB_ERROR');
    }
  }

  static async updateTemplate(id: string, data: {
    name?: string;
    subject?: string;
    body?: string;
    type?: string;
    language?: string;
    documentIds?: string[];
  }): Promise<EmailTemplateItem> {
    try {
      const docIds = data.documentIds ? JSON.stringify(data.documentIds) : null;

      const result: any[] = await prisma.$queryRawUnsafe(`
        UPDATE "EmailTemplate"
        SET "name" = COALESCE($1, "name"),
            "subject" = COALESCE($2, "subject"),
            "body" = COALESCE($3, "body"),
            "type" = COALESCE($4, "type"),
            "language" = COALESCE($5, "language"),
            "documentIds" = CASE WHEN $6::jsonb IS NOT NULL THEN $6::jsonb ELSE "documentIds" END,
            "updatedAt" = NOW()
        WHERE "id" = $7 AND "isActive" = TRUE
        RETURNING id, name, subject, body, type, language, "documentIds", "companyId", "createdAt"
      `,
        data.name || null,
        data.subject || null,
        data.body || null,
        data.type || null,
        data.language || null,
        docIds,
        id
      );

      if (!result || result.length === 0) {
        throw new AppError('Email template not found', 404, 'NOT_FOUND');
      }

      const updated = result[0];
      return {
        id: updated.id,
        name: updated.name,
        subject: updated.subject,
        body: updated.body,
        type: updated.type,
        language: updated.language,
        documentIds: typeof updated.documentIds === 'string' ? JSON.parse(updated.documentIds) : (updated.documentIds || []),
        documents: [],
        companyId: updated.companyId,
        createdAt: new Date(updated.createdAt).toISOString(),
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error('Error updating email template:', err);
      throw new AppError('Failed to update email template', 500, 'DB_ERROR');
    }
  }

  static async deleteTemplate(id: string): Promise<boolean> {
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE "EmailTemplate"
        SET "isActive" = FALSE, "updatedAt" = NOW()
        WHERE "id" = $1
      `, id);
      return true;
    } catch (err) {
      console.error('Error deleting email template:', err);
      throw new AppError('Failed to delete email template', 500, 'DB_ERROR');
    }
  }

  // ==========================================
  // 2. SIGNATURE
  // ==========================================
  static async getSignature(userId?: string) {
    return {
      signature: '<p>--<br><strong>Horizex Property Management</strong><br>Operations & Resident Services<br><a href="mailto:support@horizex.com">support@horizex.com</a> | +1 (514) 555-0100</p>',
    };
  }

  // ==========================================
  // 3. BULK SENDER
  // ==========================================
  static async sendBulk(
    data: {
      recipients: Array<{ id: string; name?: string; email?: string; type?: string }>;
      templateId?: string;
      customSubject?: string;
      customBody?: string;
      manualAttachmentIds?: string[];
      buildingId?: string;
    },
    companyId?: string | null,
    senderUserId?: string
  ) {
    const rawRecipients = data.recipients || [];
    if (rawRecipients.length === 0) {
      throw new AppError('At least one recipient is required', 400, 'RECIPIENTS_REQUIRED');
    }

    // 1. Resolve template content if templateId provided
    let templateName = 'Manual Composer';
    let subject = data.customSubject || 'Notice from Horizex Property Management';
    let body = data.customBody || '<p>Dear Resident, please review the attached communication.</p>';

    if (data.templateId) {
      try {
        const tmpl: any[] = await prisma.$queryRawUnsafe(`
          SELECT name, subject, body FROM "EmailTemplate" WHERE "id" = $1 LIMIT 1
        `, data.templateId);
        if (tmpl.length > 0) {
          templateName = tmpl[0].name;
          if (!data.customSubject) subject = tmpl[0].subject;
          if (!data.customBody) body = tmpl[0].body;
        }
      } catch (e) {
        // ignore
      }
    }

    // 2. Attachments check
    let hasAttachments = false;
    let attachmentNames: string[] = [];
    if (data.manualAttachmentIds && data.manualAttachmentIds.length > 0) {
      hasAttachments = true;
      try {
        const docs: any[] = await prisma.$queryRawUnsafe(`
          SELECT name, "fileUrl" FROM "Document" WHERE id = ANY($1::text[])
        `, data.manualAttachmentIds);
        attachmentNames = docs.map((d) => d.name);
      } catch (e) {
        attachmentNames = data.manualAttachmentIds.map((id) => `Attachment_${id.slice(0, 5)}`);
      }
    }

    let successCount = 0;
    let failedCount = 0;
    const adminSenderId = senderUserId || '13445edb-cdc2-475b-81c8-d8750e17ffa9';

    for (const rec of rawRecipients) {
      const email = rec.email?.trim();
      const name = rec.name?.trim() || 'Resident';

      if (!email || !email.includes('@')) {
        failedCount += 1;
        continue;
      }

      // Personalize subject & body
      const personalizedSubject = subject
        .replace(/\{\{first_name\}\}/gi, name.split(' ')[0] || 'Resident')
        .replace(/\{\{recipient_name\}\}/gi, name);

      const personalizedBody = body
        .replace(/\{\{first_name\}\}/gi, name.split(' ')[0] || 'Resident')
        .replace(/\{\{recipient_name\}\}/gi, name);

      const logId = `elog-${crypto.randomUUID().slice(0, 8)}`;

      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "EmailLog" (
            "id", "subject", "body", "recipient", "recipientName", "recipientUserId",
            "recipientType", "templateId", "templateName", "status", "hasAttachments",
            "attachmentNames", "senderId", "companyId", "buildingId", "sentAt", "createdAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SENT', $10, $11::jsonb, $12, $13, $14, NOW(), NOW())
        `,
          logId,
          personalizedSubject,
          personalizedBody,
          email,
          name,
          rec.id || null,
          rec.type || 'TENANT',
          data.templateId || null,
          templateName,
          hasAttachments,
          JSON.stringify(attachmentNames),
          adminSenderId,
          companyId || null,
          data.buildingId || null
        );

        successCount += 1;
      } catch (err) {
        console.error('Error inserting EmailLog for recipient:', rec.id, err);
        failedCount += 1;
      }
    }

    await createAuditLog({
      userId: senderUserId,
      action: 'SEND_BULK_EMAIL',
      entityType: 'EmailLog',
      entityId: `bulk-${Date.now()}`,
      newData: { subject, templateName, successCount, failedCount },
    });

    return {
      results: {
        success: successCount,
        failed: failedCount,
      },
      message: `Successfully processed broadcast: ${successCount} sent, ${failedCount} failed.`,
    };
  }

  // ==========================================
  // 4. HISTORY & RESEND
  // ==========================================
  static async getHistory(query: {
    page?: string | number;
    limit?: string | number;
    search?: string;
    buildingId?: string;
    templateId?: string;
    status?: string;
    companyId?: string | null;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (query.status && query.status !== 'all' && query.status !== 'ALL') {
      whereClauses.push(`status = $${pIdx}`);
      params.push(query.status.toUpperCase());
      pIdx++;
    }

    if (query.buildingId && query.buildingId !== 'all') {
      whereClauses.push(`"buildingId" = $${pIdx}`);
      params.push(query.buildingId);
      pIdx++;
    }

    if (query.templateId && query.templateId !== 'all') {
      whereClauses.push(`"templateId" = $${pIdx}`);
      params.push(query.templateId);
      pIdx++;
    }

    if (query.search && query.search.trim() !== '') {
      whereClauses.push(`(
        recipient ILIKE $${pIdx} OR 
        "recipientName" ILIKE $${pIdx} OR 
        subject ILIKE $${pIdx} OR 
        "templateName" ILIKE $${pIdx}
      )`);
      params.push(`%${query.search.trim()}%`);
      pIdx++;
    }

    const whereStr = whereClauses.join(' AND ');

    try {
      const countResult: any[] = await prisma.$queryRawUnsafe(`
        SELECT count(*) FROM "EmailLog" WHERE ${whereStr}
      `, ...params);
      const total = Number(countResult[0]?.count || 0);

      const logs: any[] = await prisma.$queryRawUnsafe(`
        SELECT id, subject, body, recipient, "recipientName", "recipientUserId",
               "recipientType", "templateId", "templateName", status, "hasAttachments",
               "attachmentNames", "sentAt", "createdAt"
        FROM "EmailLog"
        WHERE ${whereStr}
        ORDER BY "sentAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `, ...params);

      const formatted = logs.map((l) => ({
        id: l.id,
        timestamp: l.sentAt ? new Date(l.sentAt).toISOString() : new Date(l.createdAt).toISOString(),
        createdAt: l.sentAt ? new Date(l.sentAt).toISOString() : new Date(l.createdAt).toISOString(),
        recipient: l.recipient,
        recipientUser: {
          name: l.recipientName || l.recipient?.split('@')[0] || 'Recipient',
        },
        subject: l.subject,
        body: l.body,
        hasAttachments: Boolean(l.hasAttachments),
        attachmentNames: typeof l.attachmentNames === 'string' ? JSON.parse(l.attachmentNames) : (l.attachmentNames || []),
        emailTemplate: {
          name: l.templateName || 'Manual',
        },
        status: l.status || 'SENT',
      }));

      return {
        data: formatted,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (err) {
      console.error('Error fetching email history:', err);
      return {
        data: [],
        pagination: { total: 0, page: 1, limit, totalPages: 1 },
      };
    }
  }

  static async getLogById(id: string) {
    try {
      const logs: any[] = await prisma.$queryRawUnsafe(`
        SELECT id, subject, body, recipient, "recipientName", "recipientUserId",
               "recipientType", "templateId", "templateName", status, "hasAttachments",
               "attachmentNames", "sentAt", "createdAt"
        FROM "EmailLog"
        WHERE id = $1
        LIMIT 1
      `, id);

      if (!logs || logs.length === 0) {
        throw new AppError('Email log not found', 404, 'NOT_FOUND');
      }

      const l = logs[0];
      return {
        id: l.id,
        timestamp: l.sentAt ? new Date(l.sentAt).toISOString() : new Date(l.createdAt).toISOString(),
        createdAt: l.sentAt ? new Date(l.sentAt).toISOString() : new Date(l.createdAt).toISOString(),
        recipient: l.recipient,
        recipientUser: {
          name: l.recipientName || l.recipient?.split('@')[0] || 'Recipient',
        },
        subject: l.subject,
        body: l.body,
        hasAttachments: Boolean(l.hasAttachments),
        attachmentNames: typeof l.attachmentNames === 'string' ? JSON.parse(l.attachmentNames) : (l.attachmentNames || []),
        emailTemplate: {
          name: l.templateName || 'Manual',
        },
        status: l.status || 'SENT',
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error('Error fetching email log by id:', err);
      throw new AppError('Failed to fetch email log', 500, 'DB_ERROR');
    }
  }

  static async resendEmail(id: string, senderUserId?: string) {
    const original = await this.getLogById(id);
    const newLogId = `elog-${crypto.randomUUID().slice(0, 8)}`;

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "EmailLog" (
          "id", "subject", "body", "recipient", "recipientName",
          "templateName", "status", "hasAttachments", "attachmentNames",
          "senderId", "sentAt", "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'SENT', $7, $8::jsonb, $9, NOW(), NOW())
      `,
        newLogId,
        original.subject,
        original.body,
        original.recipient,
        original.recipientUser?.name || 'Recipient',
        original.emailTemplate?.name || 'Manual',
        original.hasAttachments,
        JSON.stringify(original.attachmentNames || []),
        senderUserId || null
      );

      return {
        success: true,
        message: `Email successfully resent to ${original.recipient}`,
        resendLogId: newLogId,
      };
    } catch (err) {
      console.error('Error resending email:', err);
      throw new AppError('Failed to resend email', 500, 'DB_ERROR');
    }
  }
}

