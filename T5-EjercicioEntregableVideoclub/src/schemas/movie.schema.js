// src/schemas/movie.schema.js
import { z } from 'zod';

const GENRES = ['action', 'comedy', 'drama', 'horror', 'scifi'];
const CURRENT_YEAR = new Date().getFullYear();
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// Schema para crear una película (POST)
export const createMovieSchema = z.object({
    body: z.object({
        title: z.string({
            required_error: 'El título es requerido',
            invalid_type_error: 'El título debe ser un texto'
        })
            .min(2, 'El título debe tener al menos 2 caracteres')
            .max(200, 'El título no puede exceder 200 caracteres'),
        director: z.string({
            required_error: 'El director es requerido',
            invalid_type_error: 'El director debe ser un texto'
        })
            .min(2, 'El director debe tener al menos 2 caracteres')
            .max(100, 'El director no puede exceder 100 caracteres'),
        year: z.number({
            required_error: 'El año es requerido',
            invalid_type_error: 'El año debe ser un número'
        })
            .int('El año debe ser un número entero')
            .min(1888, 'El año mínimo es 1888')
            .max(CURRENT_YEAR, `El año máximo es ${CURRENT_YEAR}`),
        genre: z.enum(GENRES, {
            errorMap: () => ({ message: `El género debe ser uno de: ${GENRES.join(', ')}` })
        }),
        copies: z.number({
            invalid_type_error: 'Las copias deben ser un número'
        })
            .int('Las copias deben ser un número entero')
            .min(0, 'Las copias no pueden ser negativas')
            .optional()
            .default(5)
    }).strict()
});

// Schema para actualizar una película (PUT)
export const updateMovieSchema = z.object({
    body: z.object({
        title: z.string()
            .min(2, 'El título debe tener al menos 2 caracteres')
            .max(200, 'El título no puede exceder 200 caracteres')
            .optional(),
        director: z.string()
            .min(2, 'El director debe tener al menos 2 caracteres')
            .max(100, 'El director no puede exceder 100 caracteres')
            .optional(),
        year: z.number()
            .int('El año debe ser un número entero')
            .min(1888, 'El año mínimo es 1888')
            .max(CURRENT_YEAR, `El año máximo es ${CURRENT_YEAR}`)
            .optional(),
        genre: z.enum(GENRES, {
            errorMap: () => ({ message: `El género debe ser uno de: ${GENRES.join(', ')}` })
        }).optional(),
        copies: z.number()
            .int('Las copias deben ser un número entero')
            .min(0, 'Las copias no pueden ser negativas')
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


// Schema para validar query params de listado con filtros
export const queryMoviesSchema = z.object({
    query: z.object({
        genre: z.enum(GENRES, {
            errorMap: () => ({ message: `El género debe ser uno de: ${GENRES.join(', ')}` })
        }).optional(),
        search: z.string()
            .min(1, 'El término de búsqueda no puede estar vacío')
            .max(100, 'El término de búsqueda es demasiado largo')
            .optional(),
        page: z.string()
            .regex(/^\d+$/, 'La página debe ser un número positivo')
            .transform(Number)
            .pipe(z.number().int().min(1, 'La página mínima es 1'))
            .optional()
            .default('1'),
        limit: z.string()
            .regex(/^\d+$/, 'El límite debe ser un número positivo')
            .transform(Number)
            .pipe(z.number().int().min(1, 'El límite mínimo es 1').max(100, 'El límite máximo es 100'))
            .optional()
            .default('10'),
        sortBy: z.enum(['title', 'year', 'genre', 'timesRented', 'createdAt'], {
            errorMap: () => ({ message: 'sortBy debe ser: title, year, genre, timesRented o createdAt' })
        }).optional()
            .default('createdAt'),
        order: z.enum(['asc', 'desc'], {
            errorMap: () => ({ message: 'order debe ser: asc o desc' })
        }).optional()
            .default('desc'),
        available: z.enum(['true', 'false'], {
            errorMap: () => ({ message: 'El filtro available debe ser true o false' })
        }).optional()
    })
});

// Schema para valorar una película (POST /api/movies/:id/rate)
export const rateMovieSchema = z.object({
    body: z.object({
        rating: z.number({
            required_error: 'La valoración es requerida',
            invalid_type_error: 'La valoración debe ser un número'
        })
            .min(0, 'La valoración mínima es 0')
            .max(10, 'La valoración máxima es 10')
    }).strict(),
    params: z.object({
        id: z.string().regex(objectIdRegex, 'ID debe ser un ObjectId válido')
    })
});

