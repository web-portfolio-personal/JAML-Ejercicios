import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';

/**
 * Middleware de autorización basado en roles.
 * Los roles se almacenan como String en SQLite (en PostgreSQL serían enum Role).
 * Debe usarse después de authMiddleware.
 */
const checkRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      return next(AppError.unauthorized('No autenticado'));
    }

    if (!roles.includes(user.role)) {
      return next(
        AppError.forbidden(`Rol requerido: ${roles.join(' o ')}`)
      );
    }

    next();
  };

export default checkRole;
