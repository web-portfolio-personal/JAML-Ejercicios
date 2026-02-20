// src/middleware/validate.middleware.js
import mongoose from 'mongoose';
import { ZodError } from 'zod';

/**
 * Middleware de validación con Zod
 * Valida body, query y params simultáneamente
 * Actualiza req con valores parseados (defaults, transforms aplicados)
 */
export const validate = (schema) => async (req, res, next) => {
    try {
        const parsed = await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params
        });

        // Actualizar req con los valores parseados (incluyendo defaults y transformaciones)
        // NOTA: En Express 5, req.query y req.params son read-only (solo getter),
        // por lo que se usan Object.assign para mutar sus propiedades individualmente.
        if (parsed.body) req.body = parsed.body;
        if (parsed.query) Object.assign(req.query, parsed.query);
        if (parsed.params) Object.assign(req.params, parsed.params);

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            const errors = error.errors.map(err => ({
                campo: err.path.join('.'),
                mensaje: err.message,
                codigo: err.code
            }));

            // Determinar código de estado según el tipo de error:
            // 400 - Bad Request: formato incorrecto, campos faltantes, tipo inválido
            // 422 - Unprocessable Entity: datos válidos pero reglas de negocio incumplidas
            const hasParamError = errors.some(e => e.campo.startsWith('params'));
            const hasQueryError = errors.some(e => e.campo.startsWith('query'));

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

/**
 * Middleware para validar que un param sea un ObjectId válido de MongoDB
 * Previene errores de CastError antes de llegar al controller
 */
export const validateObjectId = (paramName = 'id') => (req, res, next) => {
    const id = req.params[paramName];

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            error: 'ID inválido',
            mensaje: `El parámetro '${paramName}' no es un ObjectId válido`
        });
    }

    next();
};
