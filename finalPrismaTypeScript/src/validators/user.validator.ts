import { z } from 'zod';

// Schemas compartidos

const emailField = z
  .string({ required_error: 'Email requerido' })
  .email('Email no valido')
  .toLowerCase()
  .trim();

const passwordField = z
  .string({ required_error: 'Contrasena requerida' })
  .min(8, 'La contrasena debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una mayuscula')
  .regex(/[a-z]/, 'Debe contener al menos una minuscula')
  .regex(/[0-9]/, 'Debe contener al menos un numero')
  .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un simbolo');

const addressSchema = z
  .object({
    street:   z.string().trim().optional(),
    number:   z.string().trim().optional(),
    postal:   z.string().trim().optional(),
    city:     z.string().trim().optional(),
    province: z.string().trim().optional(),
  })
  .optional();

// 1. Registro
export const registerSchema = z.object({
  body: z.object({
    email:    emailField,
    password: passwordField,
  }),
});

// 2. Validacion de email
export const codeSchema = z.object({
  body: z.object({
    code: z
      .string({ required_error: 'Codigo requerido' })
      .length(6, 'El codigo debe tener exactamente 6 digitos')
      .regex(/^\d{6}$/, 'El codigo debe ser numerico'),
  }),
});

// 3. Login
export const loginSchema = z.object({
  body: z.object({
    email:    emailField,
    password: z.string({ required_error: 'Contrasena requerida' }).min(1),
  }),
});

// 4. Onboarding — datos personales
export const personalSchema = z.object({
  body: z.object({
    name:     z.string({ required_error: 'Nombre requerido' }).min(1, 'Nombre requerido').trim(),
    lastName: z.string({ required_error: 'Apellidos requeridos' }).min(1, 'Apellidos requeridos').trim(),
    nif:      z.string({ required_error: 'NIF requerido' }).trim(),
  }),
});

// 5. Onboarding — compania
export const companySchema = z.object({
  body: z.discriminatedUnion('isFreelance', [
    z.object({
      isFreelance: z.literal(true),
    }),
    z.object({
      isFreelance: z.literal(false),
      name:        z.string({ required_error: 'Nombre de empresa requerido' }).min(1).trim(),
      cif:         z.string({ required_error: 'CIF requerido' }).min(1).trim(),
      address:     addressSchema,
    }),
  ]),
});

// 7. Refresh token
export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string({ required_error: 'Refresh token requerido' }).min(1),
  }),
});

// 9. Cambio de contrasena
export const passwordSchema = z.object({
  body: z
    .object({
      oldPassword: z.string({ required_error: 'Contrasena actual requerida' }).min(1),
      newPassword: passwordField,
    })
    .refine((data) => data.oldPassword !== data.newPassword, {
      message: 'La nueva contrasena debe ser diferente a la actual',
      path: ['newPassword'],
    }),
});

// 10. Invitar companero
export const inviteSchema = z.object({
  body: z.object({
    email:    emailField,
    name:     z.string({ required_error: 'Nombre requerido' }).min(1).trim(),
    lastName: z.string({ required_error: 'Apellidos requeridos' }).min(1).trim(),
  }),
});
