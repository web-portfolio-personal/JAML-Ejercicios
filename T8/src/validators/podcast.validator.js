import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID no válido');

export const createPodcastSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Mínimo 3 caracteres').trim(),
    description: z.string().min(10, 'Mínimo 10 caracteres'),
    category: z.enum(['tech', 'science', 'history', 'comedy', 'news']).optional(),
    duration: z.number().min(60, 'La duración mínima es 60 segundos').optional(),
    episodes: z.number().int().positive().optional(),
    published: z.boolean().optional()
  })
});

export const updatePodcastSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    title: z.string().min(3).trim().optional(),
    description: z.string().min(10).optional(),
    category: z.enum(['tech', 'science', 'history', 'comedy', 'news']).optional(),
    duration: z.number().min(60).optional(),
    episodes: z.number().int().positive().optional(),
    published: z.boolean().optional()
  })
});

export const podcastIdSchema = z.object({
  params: z.object({ id: objectIdSchema })
});
