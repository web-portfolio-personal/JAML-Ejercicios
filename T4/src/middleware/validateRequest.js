// src/middleware/validateRequest.js
import { ZodError } from 'zod';

export const validate = (schema) => async (req, res, next) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params
        });
        next();
    } catch (error) {
        if (error instanceof ZodError) {
            const errors = error.errors.map(err => ({
                campo: err.path.join('.'),
                mensaje: err.message
            }));

            return res.status(400).json({
                error: 'Error de validación',
                detalles: errors
            });
        }
        next(error);
    }
};
