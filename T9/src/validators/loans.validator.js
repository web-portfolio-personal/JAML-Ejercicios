import { z } from 'zod';

export const createLoanSchema = z.object({
  body: z.object({
    bookId: z.number().int().positive('bookId debe ser un entero positivo')
  })
});

export const loanIdSchema = z.object({
  params: z.object({ id: z.string() })
});
