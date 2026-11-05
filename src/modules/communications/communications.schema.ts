import { z } from 'zod';

export const sendMessageSchema = z.object({
  body: z.object({
    recipientId: z.string().uuid('Valid recipient tenant ID is required'),
    channel: z.enum(['EMAIL', 'SMS']).optional().default('EMAIL'),
    subject: z.string().optional(),
    message: z.string().min(1, 'Message body is required'),
  }),
});

export const sendCampaignSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid('Valid property ID is required'),
    channel: z.enum(['EMAIL', 'SMS']).optional().default('EMAIL'),
    subject: z.string().min(1, 'Subject is required'),
    message: z.string().min(1, 'Campaign message is required'),
  }),
});

