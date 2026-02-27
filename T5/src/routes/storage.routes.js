// src/routes/storage.routes.js
import { Router } from 'express';
import uploadMiddleware from '../utils/handleStorage.js';
import { uploadFile, getFiles, getFileById, deleteFile } from '../controllers/storage.controller.js';

const router = Router();

router.get('/', getFiles);
router.get('/:id', getFileById);
router.post('/', uploadMiddleware.single('file'), uploadFile);
router.delete('/:id', deleteFile);

export default router;