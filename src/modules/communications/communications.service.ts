import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { createAuditLog } from '../../utils/auditLogger.util';
import crypto from 'crypto';

export interface SMSTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  createdAt: string;
}

let smsTemplates: SMSTemplate[] = [
  {
    id: 'tmpl-1',
    name: 'Rent Reminder',
    category: 'Billing',
    content: 'Hi {{tenantName}}, friendly reminder that rent for {{unitNumber}} is due on the 1st. Please pay via your portal.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-2',
    name: 'Maintenance Notice',
    category: 'Maintenance',
    content: 'Hello {{tenantName}}, scheduled maintenance is taking place on {{date}}. Please reach out if you have questions.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-3',
    name: 'General Notice',
    category: 'General',
    content: 'Dear Residents of {{buildingName}}, please be informed of the following update: {{announcement}}',
    createdAt: new Date().toISOString(),
  },
];

export class CommunicationsService {
  static async getTemplates(): Promise<SMSTemplate[]> {
    return smsTemplates;
  }

  static async createTemplate(data: { name: string; content: string; category?: string }): Promise<SMSTemplate> {
    const newTmpl: SMSTemplate = {
      id: `tmpl-${crypto.randomUUID()}`,
      name: data.name,
      content: data.content,
      category: data.category || 'General',
      createdAt: new Date().toISOString(),
    };
    smsTemplates.unshift(newTmpl);
    return newTmpl;
  }

  static async updateTemplate(id: string, data: { name?: string; content?: string; category?: string }): Promise<SMSTemplate> {
    const idx = smsTemplates.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new AppError('Template not found', 404, 'NOT_FOUND');
    }
    smsTemplates[idx] = {
      ...smsTemplates[idx],
      ...(data.name && { name: data.name }),
      ...(data.content && { content: data.content }),
      ...(data.category && { category: data.category }),
    };
    return smsTemplates[idx];
  }

  static async deleteTemplate(id: string): Promise<boolean> {
    const initialLen = smsTemplates.length;
    smsTemplates = smsTemplates.filter((t) => t.id !== id);
    return smsTemplates.length < initialLen;
  }

  static async listConversations(companyId?: string | null) {
    const where: any = {};
    if (companyId) {
      where.recipient = { companyId };
    }

    const messages = await prisma.communicationMessage.findMany({
      where,
      include: {
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
    });

    const conversationsMap = new Map<string, any>();
    for (const msg of messages) {
      const tenantId = msg.recipientId;
      const formattedMsg = {
        ...msg,
        content: msg.message,
        createdAt: msg.sentAt,
      };

      if (!conversationsMap.has(tenantId)) {
        conversationsMap.set(tenantId, {
          id: tenantId,
          user: {
            id: msg.recipient?.id,
            name: `${msg.recipient?.firstName || ''} ${msg.recipient?.lastName || ''}`.trim() || 'Resident',
            email: msg.recipient?.email,
            phone: msg.recipient?.phone,
            role: 'Resident',
          },
          tenant: msg.recipient,
          lastMessage: formattedMsg,
          totalMessages: 1,
          unreadCount: 0,
        });
      } else {
        conversationsMap.get(tenantId).totalMessages += 1;
      }
    }

    return Array.from(conversationsMap.values());
  }

  static async getHistory(tenantId: string) {
    const cleanId = tenantId.replace('resident_', '');
    const messages = await prisma.communicationMessage.findMany({
      where: {
        recipientId: cleanId,
      },
      orderBy: { sentAt: 'asc' },
    });

    return messages.map((m) => ({
      id: m.id,
      content: m.message,
      message: m.message,
      createdAt: m.sentAt,
      sentAt: m.sentAt,
      direction: m.senderId ? 'OUTBOUND' : 'INBOUND',
      isReadByAdmin: true,
    }));
  }

  static async sendMessage(
    data: {
      recipientId?: string;
      receiverId?: string;
      channel?: 'EMAIL' | 'SMS';
      subject?: string;
      message?: string;
      content?: string;
    },
    senderUserId?: string
  ) {
    const targetId = data.recipientId || data.receiverId;
    const bodyText = data.message || data.content;

    if (!targetId) {
      throw new AppError('Recipient tenant ID is required', 400, 'RECIPIENT_REQUIRED');
    }
    if (!bodyText) {
      throw new AppError('Message body is required', 400, 'MESSAGE_REQUIRED');
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: targetId },
    });

    if (!tenant) {
      throw new AppError('Recipient tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    const comm = await prisma.communicationMessage.create({
      data: {
        senderId: senderUserId,
        recipientId: targetId,
        channel: data.channel || 'SMS',
        subject: data.subject || null,
        message: bodyText,
      },
    });

    await createAuditLog({
      userId: senderUserId,
      action: 'SEND_COMMUNICATION',
      entityType: 'CommunicationMessage',
      entityId: comm.id,
      newData: comm,
    });

    return {
      ...comm,
      content: comm.message,
      createdAt: comm.sentAt,
    };
  }

  static async sendCampaign(
    data: {
      propertyId: string;
      channel?: 'EMAIL' | 'SMS';
      subject?: string;
      message: string;
    },
    companyId?: string | null,
    senderUserId?: string
  ) {
    const tenants = await prisma.tenant.findMany({
      where: {
        leases: {
          some: {
            unit: { propertyId: data.propertyId },
            status: 'ACTIVE',
            isActive: true,
          },
        },
      },
    });

    if (tenants.length === 0) {
      return {
        message: 'No active tenants found for this building',
        recipientsCount: 0,
      };
    }

    const messagesToCreate = tenants.map((tenant) => ({
      senderId: senderUserId,
      recipientId: tenant.id,
      channel: data.channel || 'SMS',
      subject: data.subject || 'Notice',
      message: data.message,
    }));

    await prisma.communicationMessage.createMany({
      data: messagesToCreate,
    });

    return {
      message: `Broadcast successfully dispatched to ${tenants.length} tenants`,
      recipientsCount: tenants.length,
    };
  }
}
