// src/schemas/todos.schema.js
import { z } from 'zod';

// Schema para crear una tarea
export const createTodoSchema = z.object({
    body: z.object({
        title: z.string()
            .min(3, 'El título debe tener al menos 3 caracteres')
            .max(100, 'El título no puede exceder 100 caracteres'),
        description: z.string()
            .max(500, 'La descripción no puede exceder 500 caracteres')
            .optional()
            .nullable(),
        priority: z.enum(['low', 'medium', 'high'], {
            errorMap: () => ({ message: 'La prioridad debe ser: low, medium o high' })
        }),
        completed: z.boolean().optional().default(false),
        dueDate: z.string()
            .datetime({ message: 'Fecha inválida. Usa formato ISO 8601' })
            .refine((date) => new Date(date) > new Date(), {
                message: 'La fecha de vencimiento debe ser futura'
            })
            .optional()
            .nullable(),
        tags: z.array(z.string())
            .max(5, 'Máximo 5 tags permitidos')
            .optional()
            .default([])
    })
});

// Schema para actualizar una tarea (PUT - todos los campos requeridos excepto opcionales)
export const updateTodoSchema = z.object({
    body: z.object({
        title: z.string()
            .min(3, 'El título debe tener al menos 3 caracteres')
            .max(100, 'El título no puede exceder 100 caracteres'),
        description: z.string()
            .max(500, 'La descripción no puede exceder 500 caracteres')
            .optional()
            .nullable(),
        priority: z.enum(['low', 'medium', 'high'], {
            errorMap: () => ({ message: 'La prioridad debe ser: low, medium o high' })
        }),
        completed: z.boolean().optional(),
        dueDate: z.string()
            .datetime({ message: 'Fecha inválida. Usa formato ISO 8601' })
            .refine((date) => new Date(date) > new Date(), {
                message: 'La fecha de vencimiento debe ser futura'
            })
            .optional()
            .nullable(),
        tags: z.array(z.string())
            .max(5, 'Máximo 5 tags permitidos')
            .optional()
            .default([])
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
            .optional()
            .nullable(),
        priority: z.enum(['low', 'medium', 'high'], {
            errorMap: () => ({ message: 'La prioridad debe ser: low, medium o high' })
        }).optional(),
        completed: z.boolean().optional(),
        dueDate: z.string()
            .datetime({ message: 'Fecha inválida. Usa formato ISO 8601' })
            .refine((date) => new Date(date) > new Date(), {
                message: 'La fecha de vencimiento debe ser futura'
            })
            .optional()
            .nullable(),
        tags: z.array(z.string())
            .max(5, 'Máximo 5 tags permitidos')
            .optional()
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
export const queryTodosSchema = z.object({
    query: z.object({
        completed: z.enum(['true', 'false']).optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        tag: z.string().optional(),
        sortBy: z.enum(['dueDate', 'createdAt', 'priority', 'title']).optional(),
        order: z.enum(['asc', 'desc']).optional().default('asc'),
        search: z.string().optional() // BONUS: búsqueda fuzzy
    }).optional()
});
