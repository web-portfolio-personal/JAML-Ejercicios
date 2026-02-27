// src/utils/handleCoverUpload.js
import multer from 'multer';
import { extname, join } from 'node:path';

// Node.js 20.11+
const __dirname = import.meta.dirname;

// Configuración de almacenamiento para carátulas
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = join(__dirname, '../../storage');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = extname(file.originalname).toLowerCase();
        cb(null, `cover-${uniqueSuffix}${ext}`);
    }
});

// Solo imágenes permitidas para carátulas
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (jpeg, png, webp, gif)'), false);
    }
};

// Middleware de upload para carátulas — máximo 5MB, solo 1 archivo
const coverUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1
    }
});

export default coverUpload;

