import { z } from 'zod';

export const createReviewSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    rating: z.number().int().min(1, 'Rating mínimo 1').max(5, 'Rating máximo 5'),
    comment: z.string().optional()
  })
});

export const reviewIdSchema = z.object({
  params: z.object({ id: z.string() })
});
