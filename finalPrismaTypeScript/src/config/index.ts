import { z } from 'zod';
import prisma from '../lib/prisma';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  PUBLIC_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno invalidas:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join('.') || 'env'}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;

export const connectDb = async (): Promise<void> => {
  await prisma.$connect();
  console.log('Conectado a la base de datos via Prisma');
};
