// src/utils/handleError.js

/**
 * Función helper para responder con un error HTTP de forma directa.
 * Útil en controladores cuando no se quiere usar next(error).
 *
 * @param {import('express').Response} res - Objeto Response de Express
 * @param {string} message - Mensaje de error
 * @param {number} code - Código HTTP (por defecto 500)
 */
export const handleHttpError = (res, message = 'Error interno', code = 500) => {
    res.status(code).json({
        error: true,
        message
    });
};

/**
 * Clase de error personalizado para la API.
 * Permite crear errores con código HTTP y estado asociado.
 *
 * @example
 *   throw new AppError('Usuario no encontrado', 404);
 */
export class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        // Marca el error como operacional (previsto), no un bug
        this.isOperational = true;
    }
}

