import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import AppError from '../utils/AppError';

/**
 * Middleware generico de validacion con Zod.
 * Valida body, query y params; aplica los valores transformados de vuelta a req.
 */
export const validate = (schema: ZodSchema) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return next(
        Object.assign(AppError.badRequest('Error de validacion'), { details })
      );
    }

    // Aplicar valores transformados (ej. email lowercase)
    // NOTA: En Express 5, req.query es un getter-only → se sobreescribe con defineProperty
    if (result.data.body !== undefined) req.body = result.data.body;
    if (result.data.query !== undefined) {
      const validatedQuery = result.data.query as Record<string, unknown>;
      Object.defineProperty(req, 'query', {
        get: () => validatedQuery,
        configurable: true,
      });
    }
    if (result.data.params !== undefined) req.params = result.data.params as Record<string, string>;

    next();
  };
