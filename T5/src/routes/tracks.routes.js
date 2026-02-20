// src/routes/tracks.routes.js
import { Router } from 'express';
import {
    getTracks,
    getTrack,
    createTrack,
    updateTrack,
    deleteTrack
} from '../controllers/tracks.controller.js';
import { validate, validateObjectId } from '../middleware/validate.middleware.js';
import { createTrackSchema, updateTrackSchema } from '../schemas/track.schema.js';

const router = Router();

router.get('/', getTracks);
router.get('/:id', validateObjectId(), getTrack);
router.post('/', validate(createTrackSchema), createTrack);
router.put('/:id', validateObjectId(), validate(updateTrackSchema), updateTrack);
router.delete('/:id', validateObjectId(), deleteTrack);

export default router;

