// src/middleware/error.middleware.js
import mongoose from 'mongoose';

/**
 * Clase de error personalizado para la API
 * Errores operacionales = errores previsibles (400, 404, 409...)
 */
export class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
    }

    // 4xx - Errores del cliente
    static badRequest(message = 'Solicitud inválida', details = null) {
        return new ApiError(400, message, details);
    }

    static unauthorized(message = 'No autorizado') {
        return new ApiError(401, message);
    }

    static forbidden(message = 'Acceso denegado') {
        return new ApiError(403, message);
    }

    static notFound(message = 'Recurso no encontrado') {
        return new ApiError(404, message);
    }

    static conflict(message = 'Conflicto con el estado actual') {
        return new ApiError(409, message);
    }

    static unprocessableEntity(message = 'Datos no procesables', details = null) {
        return new ApiError(422, message, details);
    }

    static tooManyRequests(message = 'Demasiadas solicitudes') {
        return new ApiError(429, message);
    }

    // 5xx - Errores del servidor (solo para errores reales)
    static internal(message = 'Error interno del servidor') {
        return new ApiError(500, message);
    }
}

/**
 * Middleware para rutas no encontradas (404)
 */
export const notFound = (req, res, next) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.originalUrl,
        method: req.method
    });
};

/**
 * Middleware centralizado de manejo de errores
 * Express requiere los 4 parámetros (err, req, res, next) para identificarlo como error handler
 */
export const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err);

    // Errores operacionales (controlados por nosotros con ApiError)
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            error: err.message,
            ...(err.details && { detalles: err.details })
        });
    }

    // Error de validación de Mongoose -> 400
    if (err instanceof mongoose.Error.ValidationError) {
        const detalles = Object.values(err.errors).map(e => ({
            campo: e.path,
            mensaje: e.message
        }));
        return res.status(400).json({
            error: 'Error de validación',
            detalles
        });
    }

    // Error de Cast de Mongoose (ID inválido, tipo incorrecto) -> 400
    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({
            error: 'Formato inválido',
            mensaje: `El valor proporcionado no es válido para el campo '${err.path}'`
        });
    }

    // Error de índice duplicado (unique constraint) -> 409
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({
            error: 'Duplicado',
            mensaje: `Ya existe un registro con ese '${field}'`
        });
    }

    // Error de JSON mal formado (cliente envió JSON inválido) -> 400
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            error: 'JSON mal formado',
            mensaje: 'El cuerpo de la solicitud no es un JSON válido'
        });
    }

    // Error de tipo (cliente envió datos con tipo incorrecto) -> 400
    if (err.name === 'TypeError' && err.message.includes('Cannot read')) {
        return res.status(400).json({
            error: 'Datos inválidos',
            mensaje: 'Los datos enviados no tienen el formato esperado'
        });
    }

    // Solo para errores reales del servidor (bugs, fallos de conexión, etc.)
    // En desarrollo mostramos info extra, en producción ocultamos detalles
    const isDev = process.env.NODE_ENV === 'development';

    res.status(500).json({
        error: 'Error interno del servidor',
        ...(isDev && { stack: err.stack, message: err.message })
    });
};
