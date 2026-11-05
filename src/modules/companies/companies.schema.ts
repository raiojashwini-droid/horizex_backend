import { z } from 'zod';

export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Company name is required'),
    code: z.string().min(2, 'Company code is required').toUpperCase(),
    contactEmail: z.string().email('Valid email is required').optional(),
    contactPhone: z.string().optional(),
    taxNumber: z.string().optional(),
  }).passthrough(),
});

export const updateCompanySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid company ID format'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    taxNumber: z.string().optional(),
  }),
});

