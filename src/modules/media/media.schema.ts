import { z } from 'zod';

export const signatureRequestSchema = z.object({
  body: z.object({
    folder: z.string().optional().default('horizex_properties'),
  }),
});

export const base64UploadSchema = z.object({
  body: z.object({
    imageBase64: z.string().min(1, 'Base64 image string is required'),
    folder: z.string().optional().default('horizex_properties'),
  }),
});

