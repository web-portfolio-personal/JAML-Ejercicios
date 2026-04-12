import multer from 'multer';
import { extname, join } from 'node:path';

const __dirname = import.meta.dirname;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, join(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `logo-${suffix}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Multer requiere un Error estándar en el callback (no AppError)
    const err = new Error('Solo se permiten imágenes (jpeg, png, gif, webp)');
    err.code = 'LIMIT_FILE_TYPE';
    cb(err);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export default upload;
