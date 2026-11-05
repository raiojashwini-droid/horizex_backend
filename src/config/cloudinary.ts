import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Generates parameters and SHA signature for direct client-to-Cloudinary upload.
 * No file buffers or Multer pass through Express!
 */
export const generateCloudinarySignature = (folder: string = 'horizex_properties') => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const paramsToSign = {
    folder,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);

  return {
    signature,
    timestamp,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    folder,
  };
};

/**
 * Direct upload helper for Base64 Data URI strings without Multer.
 */
export const uploadBase64Image = async (
  base64Data: string,
  folder: string = 'horizex_properties'
): Promise<{ url: string; publicId: string }> => {
  const result = await cloudinary.uploader.upload(base64Data, {
    folder,
    resource_type: 'auto',
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

export { cloudinary };

