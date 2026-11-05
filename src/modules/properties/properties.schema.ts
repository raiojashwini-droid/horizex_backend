import { z } from 'zod';

export const createPropertySchema = z.object({
  body: z
    .object({
      companyId: z.string().optional(),
      name: z.string().min(1, 'Property name is required'),
      address: z.string().optional(),
      street: z.string().optional(),
      civicNumber: z.string().optional(),
      city: z.string().optional().default('Montreal'),
      state: z.string().optional(),
      province: z.string().optional(),
      postalCode: z.string().optional().default('H1A 1A1'),
      totalUnits: z.union([z.number(), z.string()]).optional().default(0),
      units: z.union([z.number(), z.string()]).optional(),
    })
    .passthrough(),
});

export const updatePropertySchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z
    .object({
      companyId: z.string().optional(),
      name: z.string().min(1).optional(),
      address: z.string().optional(),
      street: z.string().optional(),
      civicNumber: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      province: z.string().optional(),
      postalCode: z.string().optional(),
      totalUnits: z.union([z.number(), z.string()]).optional(),
      units: z.union([z.number(), z.string()]).optional(),
    })
    .passthrough(),
});


