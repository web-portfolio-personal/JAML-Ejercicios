// src/controllers/movies.controller.js
import Movie from '../models/movie.model.js';
import { ApiError } from '../middleware/error.middleware.js';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3000';

// Escapar caracteres especiales de regex para prevenir inyección (ReDoS)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/movies — Listar películas con filtros, paginación, búsqueda
export const getMovies = async (req, res, next) => {
    try {
        const query = req.validatedQuery || req.query;
        const { page = 1, limit = 10, genre, search, available, sortBy = 'createdAt', order = 'desc' } = query;

        // Filtro dinámico
        const filter = {};
        if (genre) filter.genre = genre;
        if (available === 'true') filter.availableCopies = { $gt: 0 };
        if (available === 'false') filter.availableCopies = 0;
        if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };

        const skip = (Number(page) - 1) * Number(limit);
        const sortOrder = order === 'asc' ? 1 : -1;

        const [movies, total] = await Promise.all([
            Movie.find(filter)
                .skip(skip)
                .limit(Number(limit))
                .sort({ [sortBy]: sortOrder })
                .lean(),
            Movie.countDocuments(filter)
        ]);

        res.json({
            data: movies,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/movies/available — Solo películas con copias disponibles
export const getAvailableMovies = async (req, res, next) => {
    try {
        const movies = await Movie.find({ availableCopies: { $gt: 0 } })
            .sort({ title: 1 })
            .lean();

        res.json({ data: movies });
    } catch (error) {
        next(error);
    }
};

// GET /api/movies/stats/top — Top 5 más alquiladas
export const getTopMovies = async (req, res, next) => {
    try {
        const movies = await Movie.find({ timesRented: { $gt: 0 } })
            .sort({ timesRented: -1 })
            .limit(5)
            .select('title director genre timesRented year rating')
            .lean();

        res.json({ data: movies });
    } catch (error) {
        next(error);
    }
};

// GET /api/movies/:id — Obtener película por ID
export const getMovie = async (req, res, next) => {
    try {
        const movie = await Movie.findById(req.params.id).lean();

        if (!movie) {
            throw ApiError.notFound('Película no encontrada');
        }

        res.json({ data: movie });
    } catch (error) {
        next(error);
    }
};

// POST /api/movies — Crear película
export const createMovie = async (req, res, next) => {
    try {
        const { title, director, year, genre, copies } = req.body;
        const movie = await Movie.create({ title, director, year, genre, copies });
        res.status(201).json({ data: movie });
    } catch (error) {
        next(error);
    }
};

// PUT /api/movies/:id — Actualizar película
export const updateMovie = async (req, res, next) => {
    try {
        // Solo incluir los campos que realmente se enviaron (sin undefined)
        const allowedFields = ['title', 'director', 'year', 'genre', 'copies'];
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Si se actualiza copies, recalcular availableCopies proporcionalmente
        if (updateData.copies !== undefined) {
            const currentMovie = await Movie.findById(req.params.id);
            if (!currentMovie) {
                throw ApiError.notFound('Película no encontrada');
            }
            const rented = currentMovie.copies - currentMovie.availableCopies;
            updateData.availableCopies = Math.max(0, updateData.copies - rented);
        }

        const movie = await Movie.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!movie) {
            throw ApiError.notFound('Película no encontrada');
        }

        res.json({ data: movie });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/movies/:id — Eliminar película (y su carátula si existe)
export const deleteMovie = async (req, res, next) => {
    try {
        const movie = await Movie.findByIdAndDelete(req.params.id);

        if (!movie) {
            throw ApiError.notFound('Película no encontrada');
        }

        // Eliminar archivo de carátula si existe
        if (movie.cover) {
            try {
                const filePath = join(process.cwd(), 'storage', movie.cover);
                await unlink(filePath);
            } catch {
                // Si el archivo no existe físicamente, no pasa nada
                console.warn(`⚠️ Carátula no encontrada en disco: ${movie.cover}`);
            }
        }

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

// POST /api/movies/:id/rent — Alquilar película
export const rentMovie = async (req, res, next) => {
    try {
        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            throw ApiError.notFound('Película no encontrada');
        }

        if (movie.availableCopies === 0) {
            throw ApiError.conflict('No hay copias disponibles para alquilar');
        }

        movie.availableCopies -= 1;
        movie.timesRented += 1;
        await movie.save();

        res.json({
            data: movie,
            message: `Película "${movie.title}" alquilada correctamente. Copias disponibles: ${movie.availableCopies}`
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/movies/:id/return — Devolver película
export const returnMovie = async (req, res, next) => {
    try {
        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            throw ApiError.notFound('Película no encontrada');
        }

        if (movie.availableCopies >= movie.copies) {
            throw ApiError.conflict('Todas las copias ya están disponibles, no se puede devolver más');
        }

        movie.availableCopies += 1;
        await movie.save();

        res.json({
            data: movie,
            message: `Película "${movie.title}" devuelta correctamente. Copias disponibles: ${movie.availableCopies}`
        });
    } catch (error) {
        next(error);
    }
};

// PATCH /api/movies/:id/cover — Subir/reemplazar carátula
export const uploadCover = async (req, res, next) => {
    try {
        if (!req.file) {
            throw ApiError.badRequest('No se subió ningún archivo de carátula');
        }

        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            // Eliminar el archivo subido ya que la película no existe
            try {
                await unlink(req.file.path);
            } catch {
                // Ignorar
            }
            throw ApiError.notFound('Película no encontrada');
        }

        // Si ya tiene carátula, eliminar la anterior
        if (movie.cover) {
            try {
                const oldPath = join(process.cwd(), 'storage', movie.cover);
                await unlink(oldPath);
            } catch {
                console.warn(`⚠️ Carátula anterior no encontrada: ${movie.cover}`);
            }
        }

        movie.cover = req.file.filename;
        await movie.save();

        res.json({
            data: movie,
            coverUrl: `${PUBLIC_URL}/uploads/${req.file.filename}`
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/movies/:id/cover — Obtener imagen de carátula
export const getCover = async (req, res, next) => {
    try {
        const movie = await Movie.findById(req.params.id).select('cover title').lean();

        if (!movie) {
            throw ApiError.notFound('Película no encontrada');
        }

        if (!movie.cover) {
            throw ApiError.notFound('Esta película no tiene carátula');
        }

        const filePath = join(process.cwd(), 'storage', movie.cover);
        res.sendFile(filePath);
    } catch (error) {
        next(error);
    }
};

// POST /api/movies/:id/rate — Valorar película (BONUS)
export const rateMovie = async (req, res, next) => {
    try {
        const { rating } = req.body;
        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            throw ApiError.notFound('Película no encontrada');
        }

        // Calcular nueva media ponderada
        const totalRating = movie.rating.average * movie.rating.count;
        movie.rating.count += 1;
        movie.rating.average = Number(((totalRating + rating) / movie.rating.count).toFixed(2));
        await movie.save();

        res.json({
            data: movie,
            message: `Película "${movie.title}" valorada con ${rating}. Media actual: ${movie.rating.average}`
        });
    } catch (error) {
        next(error);
    }
};

