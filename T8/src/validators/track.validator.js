import { z } from 'zod';

export const createTrackSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).trim(),
    duration: z.number().int().positive(),
    genres: z.array(z.string()).optional()
  })
});

export const updateTrackSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).trim().optional(),
    duration: z.number().int().positive().optional(),
    genres: z.array(z.string()).optional()
  })
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID no válido')
  })
});
