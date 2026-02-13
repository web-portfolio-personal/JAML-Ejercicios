// src/middleware/errorHandler.js

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

    // 5xx - Errores del servidor (solo para errores reales del servidor)
    static internal(message = 'Error interno del servidor') {
        return new ApiError(500, message);
    }
}

export const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.originalUrl,
        method: req.method
    });
};

export const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err);

    // Errores operacionales (controlados por nosotros)
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            error: err.message,
            ...(err.details && { detalles: err.details })
        });
    }

    // Error de JSON mal formado (cliente envió JSON inválido) -> 400
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            error: 'JSON mal formado',
            mensaje: 'El cuerpo de la solicitud no es un JSON válido',
            detalles: err.message
        });
    }

    // Error de tipo (cliente envió datos con tipo incorrecto) -> 400
    if (err.name === 'TypeError' && err.message.includes('Cannot read')) {
        return res.status(400).json({
            error: 'Datos inválidos',
            mensaje: 'Los datos enviados no tienen el formato esperado'
        });
    }

    // Error de cast/conversión (ID inválido, etc.) -> 400
    if (err.name === 'CastError') {
        return res.status(400).json({
            error: 'Formato inválido',
            mensaje: `El valor proporcionado no es válido para el campo ${err.path || 'especificado'}`
        });
    }

    // Error de validación genérico -> 422
    if (err.name === 'ValidationError') {
        return res.status(422).json({
            error: 'Error de validación',
            mensaje: err.message
        });
    }

    // Solo para errores reales del servidor (bugs, fallos de conexión, etc.)
    const isDev = process.env.NODE_ENV === 'development';

    res.status(500).json({
        error: 'Error interno del servidor',
        ...(isDev && { stack: err.stack, message: err.message })
    });
};
