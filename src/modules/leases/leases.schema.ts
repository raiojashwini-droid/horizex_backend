import { z } from 'zod';

export const createLeaseSchema = z.object({
  body: z.object({
    unitId: z.string().min(1, 'Unit ID is required'),
    tenantId: z.string().min(1, 'Tenant ID is required'),
    startDate: z.string().min(1, 'Valid start date is required'),
    endDate: z.string().min(1, 'Valid end date is required'),
    rentAmount: z.coerce.number().nonnegative().optional(),
    monthlyRent: z.coerce.number().nonnegative().optional(),
    depositAmount: z.coerce.number().nonnegative().optional().default(0),
    securityDeposit: z.coerce.number().nonnegative().optional().default(0),
  }).passthrough(),
});

export const renewLeaseSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    proposedRent: z.number().positive('Proposed rent must be positive'),
    proposedEndDate: z.string().datetime('Valid proposed end date is required'),
  }),
});

export const createMoveInspectionSchema = z.object({
  params: z.object({
    id: z.string().uuid(), // leaseId
  }),
  body: z.object({
    type: z.enum(['MOVE_IN', 'MOVE_OUT']),
    inspectorName: z.string().min(1, 'Inspector name is required'),
    checklistJson: z.record(z.any()),
    mediaUrls: z.array(z.string().url()).optional().default([]),
    signedByTenant: z.boolean().optional().default(false),
  }),
});
