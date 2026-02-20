// src/controllers/tracks.controller.js
import Track from '../models/track.model.js';
import { ApiError } from '../middleware/error.middleware.js';

// GET /api/tracks
export const getTracks = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, genre, artist, sortBy = 'createdAt', order = 'desc' } = req.query;

        // Filtro dinámico
        const filter = {};
        if (genre) filter.genres = genre;
        if (artist) filter.artist = artist;

        const skip = (Number(page) - 1) * Number(limit);
        const sortOrder = order === 'asc' ? 1 : -1;

        const [tracks, total] = await Promise.all([
            Track.find(filter)
                .populate('artist', 'name email')
                .populate('collaborators', 'name email')
                .skip(skip)
                .limit(Number(limit))
                .sort({ [sortBy]: sortOrder })
                .lean(),
            Track.countDocuments(filter)
        ]);

        res.json({
            data: tracks,
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

// GET /api/tracks/:id
export const getTrack = async (req, res, next) => {
    try {
        const track = await Track.findById(req.params.id)
            .populate('artist', 'name email')
            .populate('collaborators', 'name email');

        if (!track) {
            throw ApiError.notFound('Track no encontrado');
        }

        res.json({ data: track });
    } catch (error) {
        next(error);
    }
};

// POST /api/tracks
export const createTrack = async (req, res, next) => {
    try {
        const { title, duration, artist, collaborators, genres, releaseDate } = req.body;
        const track = await Track.create({ title, duration, artist, collaborators, genres, releaseDate });
        // Populate artist tras crear para devolver datos completos
        await track.populate('artist', 'name email');

        res.status(201).json({ data: track });
    } catch (error) {
        next(error);
    }
};

// PUT /api/tracks/:id
export const updateTrack = async (req, res, next) => {
    try {
        const { title, duration, artist, collaborators, genres, releaseDate } = req.body;
        const track = await Track.findByIdAndUpdate(
            req.params.id,
            { title, duration, artist, collaborators, genres, releaseDate },
            { new: true, runValidators: true }
        )
            .populate('artist', 'name email')
            .populate('collaborators', 'name email');

        if (!track) {
            throw ApiError.notFound('Track no encontrado');
        }

        res.json({ data: track });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/tracks/:id
export const deleteTrack = async (req, res, next) => {
    try {
        const track = await Track.findByIdAndDelete(req.params.id);

        if (!track) {
            throw ApiError.notFound('Track no encontrado');
        }

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
