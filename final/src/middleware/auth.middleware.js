import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';
import AppError from '../utils/AppError.js';
import { env } from '../config/index.js';

/**
 * Verifica el token JWT de acceso y carga el usuario en req.user.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Token no proporcionado'));
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token, env.JWT_SECRET);

  if (!payload) {
    return next(AppError.unauthorized('Token inválido o expirado'));
  }

  const user = await User.findOne({ _id: payload._id, deleted: false });
  if (!user) {
    return next(AppError.unauthorized('Usuario no encontrado'));
  }

  req.user = user;
  next();
};

export default authMiddleware;
