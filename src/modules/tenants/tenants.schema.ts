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
    tenantId: z.string().uuid('Invalid tenant ID'),
    unitId: z.string().uuid('Invalid unit ID').optional(),
    make: z.string().min(1, 'Make is required'),
    model: z.string().min(1, 'Model is required'),
    color: z.string().optional(),
    licensePlate: z.string().min(2, 'License plate is required').toUpperCase(),
    permitNumber: z.string().optional(),
  }).passthrough(),
});

export const updateVehicleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid vehicle ID'),
  }),
  body: z.object({
    tenantId: z.string().uuid('Invalid tenant ID').optional(),
    unitId: z.string().uuid('Invalid unit ID').optional(),
    make: z.string().min(1, 'Make is required').optional(),
    model: z.string().min(1, 'Model is required').optional(),
    color: z.string().optional(),
    licensePlate: z.string().min(2, 'License plate is required').toUpperCase().optional(),
    permitNumber: z.string().optional(),
  }).passthrough(),
});
