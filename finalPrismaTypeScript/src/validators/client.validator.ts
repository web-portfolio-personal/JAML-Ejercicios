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

// Prisma uses cuid by default — accept any non-empty string ID
const prismaId = z.string().min(1, 'ID no valido');

// Crear cliente
export const createClientSchema = z.object({
  body: z.object({
    name:    z.string({ required_error: 'Nombre requerido' }).min(1).trim(),
    cif:     z.string({ required_error: 'CIF requerido' }).min(1).trim(),
    email:   z.string().email('Email no valido').toLowerCase().trim().optional(),
    phone:   z.string().trim().optional(),
    address: addressSchema,
  }),
});

// Actualizar cliente
export const updateClientSchema = z.object({
  params: z.object({ id: prismaId }),
  body: z.object({
    name:    z.string().min(1).trim().optional(),
    cif:     z.string().min(1).trim().optional(),
    email:   z.string().email('Email no valido').toLowerCase().trim().optional(),
    phone:   z.string().trim().optional(),
    address: addressSchema,
  }),
});

// Parametro :id
export const idParamSchema = z.object({
  params: z.object({ id: prismaId }),
});

// Query de listado
export const listClientSchema = z.object({
  query: z.object({
    page:  z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    name:  z.string().trim().optional(),
    sort:  z.string().trim().default('-createdAt'),
  }),
});
