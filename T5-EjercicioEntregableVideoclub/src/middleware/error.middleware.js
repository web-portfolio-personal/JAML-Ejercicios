// src/middleware/error.middleware.js
import mongoose from 'mongoose';

/**
 * Clase de error personalizado para la API.
 * Errores operacionales = errores previsibles (400, 404, 409...)
 */
export class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
    }

    // Factory methods para errores comunes del proyecto
    static badRequest(message = 'Solicitud inválida', details = null) {
        return new ApiError(400, message, details);
    }

    static notFound(message = 'Recurso no encontrado') {
        return new ApiError(404, message);
    }

    static conflict(message = 'Conflicto con el estado actual') {
        return new ApiError(409, message);
    }
}

/**
 * Middleware para rutas no encontradas (404).
 * Se coloca después de todas las rutas definidas.
 */
export const notFound = (req, res, next) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.originalUrl,
        method: req.method
    });
};

/**
 * Middleware centralizado de manejo de errores.
 * Express requiere los 4 parámetros (err, req, res, next) para identificarlo como error handler.
 * Aquí NO se manejan los errores de Zod: esos se capturan en el validate middleware.
 * Este handler se encarga de:
 *   - Errores operacionales (ApiError)
 *   - Errores de Mongoose (ValidationError, CastError, duplicados)
 *   - Errores de Multer (tamaño de archivo, tipo de archivo)
 *   - Errores de JSON mal formado
 *   - Errores inesperados del servidor (500)
 */
export const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err);

    // 1. Errores operacionales (controlados por nosotros con ApiError)
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            error: err.message,
            ...(err.details && { detalles: err.details })
        });
    }

    // 2. Error de validación de Mongoose -> 400
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

    // 3. Error de Cast de Mongoose (ID inválido, tipo incorrecto) -> 400
    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({
            error: 'Formato inválido',
            mensaje: `El valor proporcionado no es válido para el campo '${err.path}'`
        });
    }

    // 4. Error de índice duplicado (unique constraint) -> 409
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({
            error: 'Duplicado',
            mensaje: `Ya existe un registro con ese '${field}'`
        });
    }

    // 5. Errores de Multer -> 400
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'Archivo demasiado grande',
            mensaje: 'El archivo excede el tamaño máximo permitido (5MB)'
        });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            error: 'Campo de archivo no esperado',
            mensaje: 'El nombre del campo del archivo no es el esperado'
        });
    }
    // Multer: tipo de archivo no permitido (se lanza como Error genérico)
    if (err.message && err.message.includes('Tipo de archivo no permitido')) {
        return res.status(400).json({
            error: 'Tipo de archivo no permitido',
            mensaje: err.message
        });
    }

    // 6. Error de JSON mal formado (cliente envió JSON inválido) -> 400
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'JSON mal formado',
            mensaje: 'El cuerpo de la solicitud no es un JSON válido'
        });
    }

    // 7. Solo para errores reales del servidor (bugs, fallos de conexión, etc.)
    // En desarrollo mostramos info extra, en producción ocultamos detalles
    const isDev = process.env.NODE_ENV === 'development';

    res.status(500).json({
        error: 'Error interno del servidor',
        ...(isDev && { stack: err.stack, message: err.message })
    });
};
