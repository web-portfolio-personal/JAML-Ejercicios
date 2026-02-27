// src/utils/handleStorage.js
import multer from 'multer';
import { extname, join } from 'node:path';

// Node.js 20.11+ - forma moderna
const __dirname = import.meta.dirname;

// Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = join(__dirname, './storage');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = extname(file.originalname).toLowerCase();
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

// Filtro de tipos de archivo
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'audio/mpeg',
        'audio/wav',
        'application/pdf'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido'), false);
    }
};

// Middleware de upload
const uploadMiddleware = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,  // 10MB
        files: 5                      // Máximo 5 archivos
    }
});

export default uploadMiddleware;