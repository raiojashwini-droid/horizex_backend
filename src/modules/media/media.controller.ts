import { Request, Response, NextFunction } from 'express';
import { generateCloudinarySignature, uploadBase64Image } from '../../config/cloudinary';
import { sendSuccess } from '../../utils/apiResponse.util';

export const getUploadSignature = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const folder = req.body.folder || 'horizex_properties';
    const signatureData = generateCloudinarySignature(folder);
    return sendSuccess(res, signatureData, 200);
  } catch (err) {
    return next(err);
  }
};

export const uploadDirectBase64 = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageBase64, folder } = req.body;
    const uploadResult = await uploadBase64Image(imageBase64, folder);
    return sendSuccess(res, uploadResult, 201);
  } catch (err) {
    return next(err);
  }
};

