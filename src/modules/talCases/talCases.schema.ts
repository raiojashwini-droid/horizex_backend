import { z } from 'zod';

export const createTalCaseSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid('Invalid property ID'),
    unitId: z.string().uuid('Invalid unit ID'),
    tenantId: z.string().uuid('Invalid tenant ID'),
    docketNumber: z.string().min(3, 'Docket number is required'),
    filingDate: z.string().datetime('Valid filing date is required'),
    amountClaimed: z.number().nonnegative('Amount claimed must be positive or zero'),
    evidenceUrls: z.array(z.string().url()).optional().default([]),
  }),
});

export const scheduleHearingSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    eventDate: z.string().datetime('Valid event date is required'),
    eventType: z.enum(['HEARING', 'DEADLINE', 'DOCUMENT_SUBMISSION']).optional().default('HEARING'),
    description: z.string().min(2, 'Description is required'),
  }),
});

