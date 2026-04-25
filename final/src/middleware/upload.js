import multer from 'multer';
import { extname, join } from 'node:path';

const __dirname = import.meta.dirname;

// ── Almacenamiento en disco (logos de compañía) ───────────────────────────────

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, join(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `logo-${suffix}${ext}`);
  },
});

const imageFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('Solo se permiten imágenes (jpeg, png, gif, webp)');
    err.code = 'LIMIT_FILE_TYPE';
    cb(err);
  }
};

// Upload en disco para logos
const upload = multer({
  storage: diskStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export default upload;

// ── Almacenamiento en memoria (firmas → Cloudinary) ───────────────────────────

export const uploadSignature = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
