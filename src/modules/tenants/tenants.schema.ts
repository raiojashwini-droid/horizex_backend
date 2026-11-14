import { z } from 'zod';

export const createTenantSchema = z.object({
  body: z.object({
    companyId: z.string().uuid().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email('Valid email is required').or(z.literal('')).optional(),
    phone: z.string().optional(),
    emergencyContact: z.string().optional(),
  }).passthrough(),
});

export const updateTenantSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email('Valid email is required').or(z.literal('')).optional(),
    phone: z.string().optional(),
    emergencyContact: z.string().optional(),
  }).passthrough(),
});

export const createVehicleSchema = z.object({
  body: z.object({
    tenantId: z.string().min(1, 'Tenant ID is required'),
    unitId: z.string().uuid('Invalid unit ID').or(z.literal('')).optional().nullable(),
    make: z.string().min(1, 'Make is required'),
    model: z.string().min(1, 'Model is required'),
    color: z.string().optional().nullable(),
    licensePlate: z.string().min(2, 'License plate is required').toUpperCase(),
    permitNumber: z.string().optional().nullable(),
  }).passthrough(),
});

export const updateVehicleSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invalid vehicle ID'),
  }),
  body: z.object({
    tenantId: z.string().or(z.literal('')).optional().nullable(),
    unitId: z.string().uuid('Invalid unit ID').or(z.literal('')).optional().nullable(),
    make: z.string().min(1, 'Make is required').optional(),
    model: z.string().min(1, 'Model is required').optional(),
    color: z.string().optional().nullable(),
    licensePlate: z.string().min(2, 'License plate is required').toUpperCase().optional(),
    permitNumber: z.string().optional().nullable(),
  }).passthrough(),
});
