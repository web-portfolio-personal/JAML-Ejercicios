export default class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  details?: unknown[];

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Solicitud incorrecta'): AppError {
    return new AppError(message, 400);
  }

  static unauthorized(message = 'No autenticado'): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = 'Acceso denegado'): AppError {
    return new AppError(message, 403);
  }

  static notFound(message = 'Recurso no encontrado'): AppError {
    return new AppError(message, 404);
  }

  static conflict(message = 'Conflicto'): AppError {
    return new AppError(message, 409);
  }

  static tooManyRequests(message = 'Demasiadas solicitudes'): AppError {
    return new AppError(message, 429);
  }

  static internal(message = 'Error interno del servidor'): AppError {
    return new AppError(message, 500);
  }
}
