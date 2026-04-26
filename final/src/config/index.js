import { z } from 'zod';
import mongoose from 'mongoose';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  PUBLIC_URL: z.string().default('http://localhost:3000'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI es requerida'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join('.') || 'env'}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;

export const dbConnect = async () => {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Conectado a MongoDB');
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  Desconectado de MongoDB');
});
