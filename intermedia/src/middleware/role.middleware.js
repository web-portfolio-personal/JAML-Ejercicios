import AppError from '../utils/AppError.js';

/**
 * Middleware de autorización basado en roles.
 * Debe usarse después de authMiddleware.
 * @param {...string} roles - Roles permitidos
 */
const checkRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(AppError.unauthorized('No autenticado'));
  }

  if (!roles.includes(req.user.role)) {
    return next(
      AppError.forbidden(`Rol requerido: ${roles.join(' o ')}`)
    );
  }

  next();
};

export default checkRole;
