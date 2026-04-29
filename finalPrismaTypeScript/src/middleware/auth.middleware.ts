import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { verifyToken } from '../utils/jwt';
import AppError from '../utils/AppError';
import { env } from '../config/index';

/**
 * Verifica el token JWT de acceso y carga el usuario en req.user.
 */
const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Token no proporcionado'));
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token, env.JWT_SECRET);

  if (!payload) {
    return next(AppError.unauthorized('Token invalido o expirado'));
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, deleted: false },
  });

  if (!user) {
    return next(AppError.unauthorized('Usuario no encontrado'));
  }

  // Attach user to request
  (req as Request & { user: typeof user }).user = user;
  next();
};

export default authMiddleware;
