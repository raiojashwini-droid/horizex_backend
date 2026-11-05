import { prisma } from '../config/db';

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string | null;
}

export const createAuditLog = async (params: AuditLogParams) => {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldData: params.oldData ? JSON.parse(JSON.stringify(params.oldData)) : undefined,
        newData: params.newData ? JSON.parse(JSON.stringify(params.newData)) : undefined,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err) {
    console.error('Failed to create audit log entry:', err);
    // Don't crash parent transaction for audit logging, but log warning
  }
};

