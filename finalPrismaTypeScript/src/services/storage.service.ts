import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

// Configurar Cloudinary desde variables de entorno
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Sube un buffer de imagen a Cloudinary.
 * Aplica Sharp para optimizar antes de subir (resize a 800px max, WebP).
 */
export const uploadImage = async (
  buffer: Buffer,
  folder = 'bildyapp',
  publicId?: string
): Promise<string> => {
  const optimized = await sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id:     publicId,
        resource_type: 'image',
        overwrite:     true,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('No result from Cloudinary'));
        resolve(result.secure_url);
      }
    );
    uploadStream.end(optimized);
  });
};

/**
 * Sube un buffer de PDF a Cloudinary.
 */
export const uploadPdf = async (
  buffer: Buffer,
  folder = 'bildyapp/pdfs',
  publicId?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id:     publicId,
        resource_type: 'raw',
        overwrite:     true,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('No result from Cloudinary'));
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
};

/**
 * Elimina un recurso de Cloudinary por su public_id.
 */
export const deleteResource = async (
  publicId: string,
  resourceType = 'image'
): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType as 'image' | 'video' | 'raw' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error eliminando recurso en Cloudinary:', message);
  }
};
