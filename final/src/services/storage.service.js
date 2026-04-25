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
 *
 * @param {Buffer} buffer - Buffer de la imagen
 * @param {string} folder - Carpeta en Cloudinary
 * @param {string} publicId - ID público del recurso
 * @returns {Promise<string>} URL segura del recurso subido
 */
export const uploadImage = async (buffer, folder = 'bildyapp', publicId) => {
  // Optimizar con Sharp: resize 800px max, convertir a WebP
  const optimized = await sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id:      publicId,
        resource_type:  'image',
        overwrite:      true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(optimized);
  });
};

/**
 * Sube un buffer de PDF a Cloudinary.
 *
 * @param {Buffer} buffer - Buffer del PDF
 * @param {string} folder - Carpeta en Cloudinary
 * @param {string} publicId - ID público del recurso
 * @returns {Promise<string>} URL segura del PDF subido
 */
export const uploadPdf = async (buffer, folder = 'bildyapp/pdfs', publicId) => {
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
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
};

/**
 * Elimina un recurso de Cloudinary por su public_id.
 */
export const deleteResource = async (publicId, resourceType = 'image') => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('⚠️  Error eliminando recurso en Cloudinary:', err.message);
  }
};
