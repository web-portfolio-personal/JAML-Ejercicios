// src/middleware/validateRequest.js
import { ZodError } from 'zod';

export const validate = (schema) => async (req, res, next) => {
    try {
        const parsed = await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params
        });

        // Actualizar req con los valores parseados (incluyendo defaults y transformaciones)
        req.body = parsed.body ?? req.body;
        req.query = parsed.query ?? req.query;
        req.params = parsed.params ?? req.params;

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            const errors = error.errors.map(err => ({
                campo: err.path.join('.'),
                mensaje: err.message,
                codigo: err.code
            }));

            // Determinar el código de estado basado en el tipo de error
            // 400 - Bad Request: errores de formato, campos requeridos faltantes
            // 422 - Unprocessable Entity: datos válidos pero con reglas de negocio incumplidas

            // Si hay errores en params (como ID inválido), es 400
            const hasParamError = errors.some(e => e.campo.startsWith('params'));
            // Si hay errores en query, es 400
            const hasQueryError = errors.some(e => e.campo.startsWith('query'));

            // Errores de tipo, formato o campos requeridos -> 400
            const isBadRequest = hasParamError || hasQueryError ||
                errors.some(e => ['invalid_type', 'invalid_string', 'too_small', 'too_big', 'invalid_enum_value'].includes(e.codigo));

            const statusCode = isBadRequest ? 400 : 422;

            return res.status(statusCode).json({
                error: 'Error de validación',
                mensaje: 'Los datos proporcionados no son válidos',
                detalles: errors.map(({ campo, mensaje }) => ({ campo, mensaje }))
            });
        }
        next(error);
    }
};
