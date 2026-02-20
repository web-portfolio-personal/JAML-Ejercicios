// src/schemas/track.schema.js
import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// Schema para crear un track (POST)
export const createTrackSchema = z.object({
    body: z.object({
        title: z.string()
            .min(3, 'El título debe tener al menos 3 caracteres')
            .max(200, 'El título no puede exceder 200 caracteres'),
        duration: z.number()
            .int('La duración debe ser un número entero')
            .min(1, 'La duración mínima es 1 segundo')
            .max(36000, 'La duración máxima es 36000 segundos (10 horas)'),
        artist: z.string()
            .regex(objectIdRegex, 'El artista debe ser un ObjectId válido'),
        collaborators: z.array(
            z.string().regex(objectIdRegex, 'Cada colaborador debe ser un ObjectId válido')
        ).optional().default([]),
        genres: z.array(
            z.string()
                .min(1, 'Cada género debe tener al menos 1 carácter')
                .max(50, 'Cada género no puede exceder 50 caracteres')
        ).min(1, 'Debe tener al menos un género')
            .refine(
                (genres) => new Set(genres).size === genres.length,
                { message: 'Los géneros no pueden estar duplicados' }
            ),
        releaseDate: z.string()
            .datetime({ message: 'Fecha inválida. Usa formato ISO 8601' })
            .optional()
    }).strict()
});

// Schema para actualizar un track (PUT)
export const updateTrackSchema = z.object({
    body: z.object({
        title: z.string()
            .min(3, 'El título debe tener al menos 3 caracteres')
            .max(200, 'El título no puede exceder 200 caracteres')
            .optional(),
        duration: z.number()
            .int('La duración debe ser un número entero')
            .min(1, 'La duración mínima es 1 segundo')
            .max(36000, 'La duración máxima es 36000 segundos (10 horas)')
            .optional(),
        artist: z.string()
            .regex(objectIdRegex, 'El artista debe ser un ObjectId válido')
            .optional(),
        collaborators: z.array(
            z.string().regex(objectIdRegex, 'Cada colaborador debe ser un ObjectId válido')
        ).optional(),
        genres: z.array(
            z.string()
                .min(1, 'Cada género debe tener al menos 1 carácter')
                .max(50, 'Cada género no puede exceder 50 caracteres')
        ).min(1, 'Debe tener al menos un género')
            .refine(
                (genres) => new Set(genres).size === genres.length,
                { message: 'Los géneros no pueden estar duplicados' }
            )
            .optional(),
        plays: z.number().int().min(0, 'Las reproducciones no pueden ser negativas').optional(),
        releaseDate: z.string()
            .datetime({ message: 'Fecha inválida. Usa formato ISO 8601' })
            .optional()
    }).strict()
        .refine(
            (data) => Object.keys(data).length > 0,
            { message: 'Debe proporcionar al menos un campo para actualizar' }
        ),
    params: z.object({
        id: z.string().regex(objectIdRegex, 'ID debe ser un ObjectId válido')
    })
});
