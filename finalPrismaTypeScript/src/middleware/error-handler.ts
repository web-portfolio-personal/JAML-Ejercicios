import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import AppError from '../utils/AppError';
import { slackError } from '../services/logger.service';

interface AppErrorLike extends Error {
  statusCode?: number;
  isOperational?: boolean;
  details?: unknown[];
  code?: string;
}

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    error: true,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (
  rawErr: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Normalise to AppErrorLike so we can inspect properties safely
  let err: AppErrorLike = rawErr instanceof Error
    ? rawErr as AppErrorLike
    : new AppError('Error interno del servidor', 500);

  // Prisma: unique constraint violation
  if (rawErr instanceof PrismaClientKnownRequestError) {
    if (rawErr.code === 'P2002') {
      err = AppError.conflict('Ya existe un registro con ese valor único');
    } else if (rawErr.code === 'P2025') {
      err = AppError.notFound('Registro no encontrado');
    } else {
      err = AppError.internal(`Error de base de datos: ${rawErr.code}`);
    }
  }

  // Multer: archivo demasiado grande
  if (err.code === 'LIMIT_FILE_SIZE') {
    err = AppError.badRequest('El archivo excede el tamaño máximo (5 MB)');
  }

  // Multer: tipo de archivo no permitido
  if (err.code === 'LIMIT_FILE_TYPE') {
    err = AppError.badRequest(err.message);
  }

  const statusCode = err.statusCode ?? 500;
  const isDev = process.env.NODE_ENV === 'development';

  // Log 5XX a Slack (no bloqueante)
  if (statusCode >= 500) {
    slackError({
      method:     _req.method,
      path:       _req.originalUrl,
      message:    err.message,
      stack:      err.stack,
      statusCode,
    });
  }

  res.status(statusCode).json({
    error: true,
    message: err.message || 'Error interno del servidor',
    ...(err.details                       && { details: err.details }),
    ...(isDev && !err.isOperational       && { stack: err.stack }),
  });
};
