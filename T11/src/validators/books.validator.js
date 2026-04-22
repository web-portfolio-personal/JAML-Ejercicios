import { z } from 'zod';

export const createBookSchema = z.object({
  body: z.object({
    isbn: z.string().min(1, 'ISBN es requerido').trim(),
    title: z.string().min(1, 'Título es requerido').trim(),
    author: z.string().min(1, 'Autor es requerido').trim(),
    genre: z.string().min(1, 'Género es requerido').trim(),
    description: z.string().optional(),
    publishedYear: z.number().int().min(1000).max(new Date().getFullYear()),
    copies: z.number().int().min(1, 'Debe haber al menos 1 ejemplar')
  })
});

export const updateBookSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    isbn: z.string().min(1).trim().optional(),
    title: z.string().min(1).trim().optional(),
    author: z.string().min(1).trim().optional(),
    genre: z.string().min(1).trim().optional(),
    description: z.string().optional(),
    publishedYear: z.number().int().min(1000).max(new Date().getFullYear()).optional(),
    copies: z.number().int().min(1).optional(),
    available: z.number().int().min(0).optional()
  })
});

export const bookIdSchema = z.object({
  params: z.object({ id: z.string() })
});
