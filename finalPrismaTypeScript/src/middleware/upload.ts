import multer, { FileFilterCallback } from 'multer';
import { extname, join } from 'node:path';
import { Request } from 'express';

// Almacenamiento en disco (logos de compania)
const diskStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, join(__dirname, '../../uploads'));
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `logo-${suffix}${ext}`);
  },
});

const imageFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = Object.assign(new Error('Solo se permiten imagenes (jpeg, png, gif, webp)'), {
      code: 'LIMIT_FILE_TYPE',
    });
    cb(err as unknown as null, false);
  }
};

// Upload en disco para logos
const upload = multer({
  storage: diskStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export default upload;

// Almacenamiento en memoria (firmas → Cloudinary)
export const uploadSignature = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
