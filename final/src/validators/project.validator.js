import { z } from 'zod';

const addressSchema = z
  .object({
    street:   z.string().trim().optional(),
    number:   z.string().trim().optional(),
    postal:   z.string().trim().optional(),
    city:     z.string().trim().optional(),
    province: z.string().trim().optional(),
  })
  .optional();

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().regex(objectIdRegex, 'ID no válido');

// ── Crear proyecto ────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  body: z.object({
    client:      objectId,
    name:        z.string({ required_error: 'Nombre requerido' }).min(1).trim(),
    projectCode: z.string({ required_error: 'Código de proyecto requerido' }).min(1).trim(),
    address:     addressSchema,
    email:       z.string().email('Email no válido').toLowerCase().trim().optional(),
    notes:       z.string().trim().optional(),
    active:      z.boolean().default(true),
  }),
});

// ── Actualizar proyecto ───────────────────────────────────────────────────────

export const updateProjectSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    client:      objectId.optional(),
    name:        z.string().min(1).trim().optional(),
    projectCode: z.string().min(1).trim().optional(),
    address:     addressSchema,
    email:       z.string().email('Email no válido').toLowerCase().trim().optional(),
    notes:       z.string().trim().optional(),
    active:      z.boolean().optional(),
  }),
});

// ── Parámetro :id ─────────────────────────────────────────────────────────────

export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
});

// ── Query de listado ──────────────────────────────────────────────────────────

export const listProjectSchema = z.object({
  query: z.object({
    page:   z.coerce.number().int().positive().default(1),
    limit:  z.coerce.number().int().positive().max(100).default(10),
    name:   z.string().trim().optional(),
    client: z.string().regex(objectIdRegex).optional(),
    active: z
      .string()
      .transform((v) => v === 'true')
      .optional(),
    sort:   z.string().trim().default('-createdAt'),
  }),
});
