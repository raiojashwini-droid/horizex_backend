import { z } from 'zod';

export const createUnitSchema = z.object({
  body: z
    .object({
      propertyId: z.string().min(1, 'Property ID is required'),
      unitTypeId: z.string().optional().nullable(),
      unitType: z.string().optional().nullable(),
      unitNumber: z.string().min(1, 'Unit number is required'),
      floor: z.coerce.number().int().optional().nullable().default(1),
      bedrooms: z.coerce.number().int().nonnegative().optional().default(1),
      bathrooms: z.coerce.number().positive().optional().default(1.0),
      squareFeet: z.coerce.number().int().positive().optional().nullable(),
      baseRent: z.coerce.number().positive().optional().default(1200),
      status: z.string().optional(),
      rentalMode: z.string().optional(),
    })
    .passthrough(),
});

export const updateUnitSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z
    .object({
      unitTypeId: z.string().optional().nullable(),
      unitType: z.string().optional().nullable(),
      unitNumber: z.string().optional(),
      floor: z.coerce.number().int().optional().nullable(),
      bedrooms: z.coerce.number().int().nonnegative().optional(),
      bathrooms: z.coerce.number().positive().optional(),
      squareFeet: z.coerce.number().int().positive().optional().nullable(),
      baseRent: z.coerce.number().positive().optional(),
      status: z.string().optional(),
    })
    .passthrough(),
});

export const updateReadinessSchema = z.object({
  params: z.object({
    id: z.string().uuid(), // unitId
  }),
  body: z.object({
    stage: z
      .enum([
        'NOTICE_GIVEN',
        'MOVE_OUT_INSPECTION',
        'TRASH_OUT',
        'MAINTENANCE_REPAIRS',
        'PAINTING',
        'DEEP_CLEANING',
        'FINAL_INSPECTION',
        'READY_TO_LEASE',
      ])
      .optional(),
    assignedWorker: z.string().optional(),
    turnoverDeadline: z.string().datetime().optional(),
    cleaningComplete: z.boolean().optional(),
    paintComplete: z.boolean().optional(),
    repairComplete: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

