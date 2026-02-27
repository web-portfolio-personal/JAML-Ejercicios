// src/routes/movies.routes.js
import { Router } from 'express';
import {
    getMovies,
    getAvailableMovies,
    getTopMovies,
    getMovie,
    createMovie,
    updateMovie,
    deleteMovie,
    rentMovie,
    returnMovie,
    uploadCover,
    getCover,
    rateMovie
} from '../controllers/movies.controller.js';
import { validate, validateObjectId } from '../middleware/validate.middleware.js';
import {
    createMovieSchema,
    updateMovieSchema,
    queryMoviesSchema,
    rateMovieSchema
} from '../schemas/movie.schema.js';
import coverUpload from '../utils/handleCoverUpload.js';

const router = Router();

// Rutas especiales (ANTES de las rutas con :id para evitar conflictos)
router.get('/available', getAvailableMovies);
router.get('/stats/top', getTopMovies);

// CRUD
router.get('/', validate(queryMoviesSchema), getMovies);
router.get('/:id', validateObjectId(), getMovie);
router.post('/', validate(createMovieSchema), createMovie);
router.put('/:id', validateObjectId(), validate(updateMovieSchema), updateMovie);
router.delete('/:id', validateObjectId(), deleteMovie);

// Alquilar y devolver
router.post('/:id/rent', validateObjectId(), rentMovie);
router.post('/:id/return', validateObjectId(), returnMovie);

// Carátulas
router.patch('/:id/cover', validateObjectId(), coverUpload.single('cover'), uploadCover);
router.get('/:id/cover', validateObjectId(), getCover);

// Valorar (BONUS)
router.post('/:id/rate', validate(rateMovieSchema), rateMovie);

export default router;

