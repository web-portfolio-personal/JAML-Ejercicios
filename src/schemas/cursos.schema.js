// src/schemas/cursos.schema.js
import { z } from 'zod';

export const createCursoSchema = z.object({
    body: z.object({
        titulo: z.string()
            .min(3, 'El título debe tener al menos 3 caracteres')
            .max(100, 'El título no puede exceder 100 caracteres'),
        lenguaje: z.enum(['javascript', 'python', 'java', 'csharp']),
        nivel: z.enum(['basico', 'intermedio', 'avanzado']),
        descripcion: z.string().optional()
    })
});

export const updateCursoSchema = z.object({
    body: z.object({
        titulo: z.string().min(3).max(100).optional(),
        lenguaje: z.enum(['javascript', 'python', 'java', 'csharp']).optional(),
        nivel: z.enum(['basico', 'intermedio', 'avanzado']).optional(),
        descripcion: z.string().optional()
    }),
    params: z.object({
        id: z.string().regex(/^\d+$/, 'ID debe ser numérico')
    })
});