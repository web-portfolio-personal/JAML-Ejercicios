import { User } from '@prisma/client';

/**
 * Augmentación del módulo Express para añadir el usuario autenticado
 * a todos los objetos Request sin necesidad de tipos personalizados.
 */
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
