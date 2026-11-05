import { z } from 'zod';

export const createTicketSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid('Invalid property ID').or(z.string().min(1)),
    unitId: z.string().uuid('Invalid unit ID').optional().nullable().or(z.literal('')),
    unit: z.string().optional(),
    unitNumber: z.string().optional(),
    aptNumber: z.string().optional(),
    tenantId: z.string().optional().nullable().or(z.literal('')),
    tenant: z.string().optional(),
    tenantName: z.string().optional(),
    building: z.string().optional(),
    propertyName: z.string().optional(),
    email: z.string().optional(),
    title: z.string().optional(),
    subject: z.string().optional(),
    description: z.string().optional(),
    desc: z.string().optional(),
    priority: z.preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      z.enum(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']).optional().default('MEDIUM')
    ),
    photoUrls: z.array(z.string()).optional().default([]),
    status: z.string().optional(),
  }).passthrough(),
});

export const updateTicketStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.preprocess(
      (val) => {
        if (typeof val !== 'string') return val;
        const upper = val.toUpperCase().replace(/\s+/g, '_');
        if (upper === 'NEW' || upper === 'SUBMITTED' || upper === 'OPEN' || upper === 'DRAFT') return 'SUBMITTED';
        if (upper === 'IN_PROGRESS' || upper === 'ASSIGNED' || upper === 'ACCEPTED') return 'IN_PROGRESS';
        if (upper === 'WAITING_PARTS' || upper === 'WAITING_VENDOR' || upper === 'PENDING_PARTS') return 'PENDING_PARTS';
        if (upper === 'COMPLETED' || upper === 'RESOLVED') return 'RESOLVED';
        if (upper === 'CLOSED' || upper === 'REJECTED') return 'CLOSED';
        return upper;
      },
      z.enum(['SUBMITTED', 'IN_PROGRESS', 'PENDING_PARTS', 'RESOLVED', 'CLOSED'])
    ),
    resolutionNote: z.string().optional().nullable(),
    photoUrls: z.array(z.string()).optional(),
  }),
});

export const assignTicketSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    staffProfileId: z.string().min(1, 'Valid staff profile ID is required'),
  }),
});

export const updateTicketSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ticket ID'),
  }),
  body: z.object({
    title: z.string().optional(),
    subject: z.string().optional(),
    description: z.string().optional(),
    desc: z.string().optional(),
    priority: z.preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      z.enum(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']).optional()
    ),
    status: z.enum(['SUBMITTED', 'IN_REVIEW', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_PARTS', 'RESOLVED', 'CLOSED', 'CANCELLED']).optional(),
    propertyId: z.string().uuid().optional().nullable().or(z.literal('')),
    unitId: z.string().uuid().optional().nullable().or(z.literal('')),
    tenantId: z.string().uuid().optional().nullable().or(z.literal('')),
    photoUrls: z.array(z.string()).optional(),
  }).passthrough(),
});
