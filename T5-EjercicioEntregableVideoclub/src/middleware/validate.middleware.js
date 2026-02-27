// src/middleware/validate.middleware.js
import mongoose from 'mongoose';
import { ZodError } from 'zod';

/**
 * Middleware de validación con Zod 4.
 * Solo pasa a Zod las propiedades que el schema define (body, query, params).
 * Así un schema que solo define "body" no falla por recibir query/params extra.
 */
export const validate = (schema) => async (req, res, next) => {
    try {
        // Detectar qué propiedades define el schema (body, query, params)
        const schemaKeys = Object.keys(schema.shape || {});
        const dataToValidate = {};
        if (schemaKeys.includes('body')) dataToValidate.body = req.body;
        if (schemaKeys.includes('query')) dataToValidate.query = req.query;
        if (schemaKeys.includes('params')) dataToValidate.params = req.params;

        const parsed = await schema.parseAsync(dataToValidate);

        // Actualizar req con los valores parseados (defaults, transforms)
        if (parsed.body) req.body = parsed.body;
        if (parsed.query) {
            // Express 5: req.query puede ser read-only
            try {
                Object.assign(req.query, parsed.query);
            } catch {
                req.validatedQuery = parsed.query;
            }
        }
        if (parsed.params) {
            try {
                Object.assign(req.params, parsed.params);
            } catch {
                req.validatedParams = parsed.params;
            }
        }

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            // Zod 4 usa .issues (no .errors como Zod 3)
            const detalles = error.issues.map(issue => ({
                campo: issue.path.join('.'),
                mensaje: issue.message
            }));

            return res.status(400).json({
                error: 'Error de validación',
                mensaje: 'Los datos proporcionados no son válidos',
                detalles
            });
        }
        next(error);
    }
};

/**
 * Middleware para validar que un param sea un ObjectId válido de MongoDB.
 * Previene errores de CastError antes de llegar al controller.
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
