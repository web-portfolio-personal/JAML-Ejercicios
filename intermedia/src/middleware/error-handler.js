import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';

export const notFoundHandler = (req, res, _next) => {
  res.status(404).json({
    error: true,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (err, _req, res, _next) => {
  // Mongoose: ID inválido
  if (err instanceof mongoose.Error.CastError) {
    err = AppError.badRequest(`ID inválido: ${err.value}`);
  }

  // Mongoose: clave duplicada
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] ?? 'campo';
    err = AppError.conflict(`Ya existe un registro con ese ${field}`);
  }

  // Mongoose: error de validación
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    err = Object.assign(AppError.badRequest('Error de validación'), {
      details: messages,
    });
  }

  // Multer: archivo demasiado grande
  if (err.code === 'LIMIT_FILE_SIZE') {
    err = AppError.badRequest('El archivo excede el tamaño máximo (5 MB)');
  }

  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    error: true,
    message: err.message || 'Error interno del servidor',
    ...(err.details && { details: err.details }),
    ...(isDev && !err.isOperational && { stack: err.stack }),
  });
};
