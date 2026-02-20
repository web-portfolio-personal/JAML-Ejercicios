// src/schemas/user.schema.js
import { z } from 'zod';

// Schema para crear un usuario (POST)
export const createUserSchema = z.object({
    body: z.object({
        name: z.string()
            .min(2, 'El nombre debe tener al menos 2 caracteres')
            .max(100, 'El nombre no puede exceder 100 caracteres'),
        email: z.string()
            .email('Email no válido')
            .transform(val => val.toLowerCase().trim()),
        password: z.string()
            .min(8, 'La contraseña debe tener al menos 8 caracteres'),
        role: z.enum(['user', 'admin'], {
            errorMap: () => ({ message: 'El rol debe ser: user o admin' })
        }).optional().default('user'),
        avatar: z.string().url('URL de avatar no válida').nullish(),
        isActive: z.boolean().optional().default(true)
    }).strict()
});

// Schema para actualizar un usuario (PUT)
export const updateUserSchema = z.object({
    body: z.object({
        name: z.string()
            .min(2, 'El nombre debe tener al menos 2 caracteres')
            .max(100, 'El nombre no puede exceder 100 caracteres')
            .optional(),
        email: z.string()
            .email('Email no válido')
            .transform(val => val.toLowerCase().trim())
            .optional(),
        password: z.string()
            .min(8, 'La contraseña debe tener al menos 8 caracteres')
            .optional(),
        role: z.enum(['user', 'admin'], {
            errorMap: () => ({ message: 'El rol debe ser: user o admin' })
        }).optional(),
        avatar: z.string().url('URL de avatar no válida').nullish(),
        isActive: z.boolean().optional()
    }).strict()
        .refine(
            (data) => Object.keys(data).length > 0,
            { message: 'Debe proporcionar al menos un campo para actualizar' }
        ),
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID debe ser un ObjectId válido')
    })
});
