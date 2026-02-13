// src/schemas/todos.schema.js
import { z } from 'zod';

// Helper: Validar que una fecha sea válida y futura
const futureDateSchema = z.string()
    .datetime({ message: 'Fecha inválida. Usa formato ISO 8601' })
    .refine((date) => {
        const parsedDate = new Date(date);
        // Verificar que la fecha sea válida (no NaN) y que sea futura
        return !isNaN(parsedDate.getTime()) && parsedDate > new Date();
    }, {
        message: 'La fecha de vencimiento debe ser una fecha válida y futura'
    });

// Helper: Schema de tags con validación de unicidad
const tagsSchema = z.array(
    z.string()
        .min(1, 'Cada tag debe tener al menos 1 carácter')
        .max(30, 'Cada tag no puede exceder 30 caracteres')
)
    .max(5, 'Máximo 5 tags permitidos')
    .refine((tags) => new Set(tags).size === tags.length, {
        message: 'Los tags no pueden estar duplicados'
    });

// Schema para crear una tarea
export const createTodoSchema = z.object({
    body: z.object({
        title: z.string()
            .min(3, 'El título debe tener al menos 3 caracteres')
            .max(100, 'El título no puede exceder 100 caracteres'),
        description: z.string()
            .max(500, 'La descripción no puede exceder 500 caracteres')
            .nullish(),
        priority: z.enum(['low', 'medium', 'high'], {
            errorMap: () => ({ message: 'La prioridad debe ser: low, medium o high' })
        }),
        completed: z.boolean().optional().default(false),
        // dueDate: nullish ANTES del schema, si hay valor se valida
        dueDate: futureDateSchema.nullish(),
        tags: tagsSchema.optional().default([])
    })
});

// Schema para actualizar una tarea (PUT - campos requeridos, es reemplazo completo)
export const updateTodoSchema = z.object({
    body: z.object({
        title: z.string()
            .min(3, 'El título debe tener al menos 3 caracteres')
            .max(100, 'El título no puede exceder 100 caracteres'),
        description: z.string()
            .max(500, 'La descripción no puede exceder 500 caracteres')
            .nullish(),
        priority: z.enum(['low', 'medium', 'high'], {
            errorMap: () => ({ message: 'La prioridad debe ser: low, medium o high' })
        }),
        // En PUT, completed es requerido (reemplazo completo)
        completed: z.boolean({
            required_error: 'El campo completed es requerido en PUT'
        }),
        dueDate: futureDateSchema.nullish(),
        // En PUT, tags es requerido (puede ser array vacío)
        tags: tagsSchema
    }),
    params: z.object({
        id: z.string().uuid('ID debe ser un UUID válido')
    })
});

// Schema para actualización parcial (PATCH)
export const patchTodoSchema = z.object({
    body: z.object({
        title: z.string()
            .min(3, 'El título debe tener al menos 3 caracteres')
            .max(100, 'El título no puede exceder 100 caracteres')
            .optional(),
        description: z.string()
            .max(500, 'La descripción no puede exceder 500 caracteres')
            .nullish(),
        priority: z.enum(['low', 'medium', 'high'], {
            errorMap: () => ({ message: 'La prioridad debe ser: low, medium o high' })
        }).optional(),
        completed: z.boolean().optional(),
        dueDate: futureDateSchema.nullish(),
        tags: tagsSchema.optional()
    }),
    params: z.object({
        id: z.string().uuid('ID debe ser un UUID válido')
    })
});

// Schema para validar ID en params
export const idParamSchema = z.object({
    params: z.object({
        id: z.string().uuid('ID debe ser un UUID válido')
    })
});

// Schema para validar query params de filtros
// Normaliza completed a minúsculas para aceptar TRUE/FALSE/True/False
export const queryTodosSchema = z.object({
    query: z.object({
        // Acepta cualquier string y lo normaliza a minúsculas, luego valida
        completed: z.string()
            .transform(val => val.toLowerCase())
            .pipe(z.enum(['true', 'false']))
            .optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        tag: z.string().max(50, 'El tag no puede exceder 50 caracteres').optional(),
        sortBy: z.enum(['dueDate', 'createdAt', 'priority', 'title']).optional(),
        order: z.enum(['asc', 'desc']).optional(),
        search: z.string().max(100, 'La búsqueda no puede exceder 100 caracteres').optional()
    })
});
