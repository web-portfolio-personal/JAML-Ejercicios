import { z } from 'zod';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'ID no válido');

const workerSchema = z.object({
  name:  z.string().min(1).trim(),
  hours: z.number().min(0),
});

// ── Crear albarán ─────────────────────────────────────────────────────────────

export const createDeliveryNoteSchema = z.object({
  body: z
    .object({
      client:      objectId,
      project:     objectId,
      format:      z.enum(['material', 'hours']),
      description: z.string().trim().optional(),
      workDate:    z.coerce.date({ required_error: 'Fecha de trabajo requerida' }),

      // Campos material
      material: z.string().trim().optional(),
      quantity: z.number().min(0).optional(),
      unit:     z.string().trim().optional(),

      // Campos hours
      hours:   z.number().min(0).optional(),
      workers: z.array(workerSchema).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.format === 'material' && !data.material) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El campo material es obligatorio para albaranes de tipo material',
          path: ['material'],
        });
      }
      if (data.format === 'hours' && data.hours == null && (!data.workers || data.workers.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes indicar horas o trabajadores para albaranes de tipo horas',
          path: ['hours'],
        });
      }
    }),
});

// ── Parámetro :id ─────────────────────────────────────────────────────────────

export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
});

// ── Query de listado ──────────────────────────────────────────────────────────

export const listDeliveryNoteSchema = z.object({
  query: z.object({
    page:    z.coerce.number().int().positive().default(1),
    limit:   z.coerce.number().int().positive().max(100).default(10),
    project: z.string().regex(objectIdRegex).optional(),
    client:  z.string().regex(objectIdRegex).optional(),
    format:  z.enum(['material', 'hours']).optional(),
    signed:  z
      .string()
      .transform((v) => v === 'true')
      .optional(),
    from:    z.coerce.date().optional(),
    to:      z.coerce.date().optional(),
    sort:    z.string().trim().default('-workDate'),
  }),
});
