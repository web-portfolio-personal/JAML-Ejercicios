import { z } from 'zod';

// ── Schemas compartidos ──────────────────────────────────────────────────────

const emailField = z
  .string({ required_error: 'Email requerido' })
  .email('Email no válido')
  .toLowerCase()
  .trim();

const passwordField = z
  .string({ required_error: 'Contraseña requerida' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres');

const addressSchema = z
  .object({
    street: z.string().trim().optional(),
    number: z.string().trim().optional(),
    postal: z.string().trim().optional(),
    city: z.string().trim().optional(),
    province: z.string().trim().optional(),
  })
  .optional();

// ── 1. Registro ──────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  body: z.object({
    email: emailField,
    password: passwordField,
  }),
});

// ── 2. Validación de email ───────────────────────────────────────────────────

export const codeSchema = z.object({
  body: z.object({
    code: z
      .string({ required_error: 'Código requerido' })
      .length(6, 'El código debe tener exactamente 6 dígitos')
      .regex(/^\d{6}$/, 'El código debe ser numérico'),
  }),
});

// ── 3. Login ─────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  body: z.object({
    email: emailField,
    password: z.string({ required_error: 'Contraseña requerida' }).min(1),
  }),
});

// ── 4. Onboarding — datos personales ─────────────────────────────────────────

export const personalSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Nombre requerido' }).min(1, 'Nombre requerido').trim(),
    lastName: z.string({ required_error: 'Apellidos requeridos' }).min(1, 'Apellidos requeridos').trim(),
    nif: z.string({ required_error: 'NIF requerido' }).trim(),
  }),
});

// ── 5. Onboarding — compañía (bonus: discriminatedUnion) ─────────────────────

export const companySchema = z.object({
  body: z.discriminatedUnion('isFreelance', [
    // Autónomo: solo necesita indicar isFreelance: true
    z.object({
      isFreelance: z.literal(true),
      // El resto se rellena con datos personales del usuario en el controller
    }),
    // Empresa: requiere nombre y CIF
    z.object({
      isFreelance: z.literal(false),
      name: z.string({ required_error: 'Nombre de empresa requerido' }).min(1).trim(),
      cif: z.string({ required_error: 'CIF requerido' }).min(1).trim(),
      address: addressSchema,
    }),
  ]),
});

// ── 7. Refresh token ─────────────────────────────────────────────────────────

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string({ required_error: 'Refresh token requerido' }).min(1),
  }),
});

// ── 9. Cambio de contraseña (bonus) ──────────────────────────────────────────

export const passwordSchema = z.object({
  body: z
    .object({
      oldPassword: z.string({ required_error: 'Contraseña actual requerida' }).min(1),
      newPassword: passwordField,
    })
    .refine((data) => data.oldPassword !== data.newPassword, {
      message: 'La nueva contraseña debe ser diferente a la actual',
      path: ['newPassword'],
    }),
});

// ── 10. Invitar compañero ────────────────────────────────────────────────────

export const inviteSchema = z.object({
  body: z.object({
    email: emailField,
    name: z.string({ required_error: 'Nombre requerido' }).min(1).trim(),
    lastName: z.string({ required_error: 'Apellidos requeridos' }).min(1).trim(),
  }),
});
