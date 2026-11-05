import { Router } from 'express';
import { getUploadSignature, uploadDirectBase64 } from './media.controller';
import { validateRequest } from '../../middlewares/validate.middleware';
import { signatureRequestSchema, base64UploadSchema } from './media.schema';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// Protect all media endpoints with authentication
router.use(authenticate);

// 1. Direct Client-to-Cloudinary Signed Upload Endpoint (Recommended - Zero Server Load!)
router.post('/signature', validateRequest(signatureRequestSchema), getUploadSignature);

// 2. Base64 Upload Endpoint (No Multer required - standard JSON body)
router.post('/upload-base64', validateRequest(base64UploadSchema), uploadDirectBase64);

export default router;

