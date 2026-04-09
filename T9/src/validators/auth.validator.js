import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
    email: z.string().email('Email no válido').toLowerCase().trim(),
    password: z.string().min(8, 'Mínimo 8 caracteres').max(100),
    role: z.enum(['USER', 'LIBRARIAN', 'ADMIN']).optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email no válido').toLowerCase().trim(),
    password: z.string().min(1, 'La contraseña es requerida')
  })
});
