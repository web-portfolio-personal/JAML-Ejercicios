export default class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Solicitud incorrecta') {
    return new AppError(message, 400);
  }

  static unauthorized(message = 'No autenticado') {
    return new AppError(message, 401);
  }

  static forbidden(message = 'Acceso denegado') {
    return new AppError(message, 403);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new AppError(message, 404);
  }

  static conflict(message = 'Conflicto') {
    return new AppError(message, 409);
  }

  static tooManyRequests(message = 'Demasiadas solicitudes') {
    return new AppError(message, 429);
  }

  static internal(message = 'Error interno del servidor') {
    return new AppError(message, 500);
  }
}
