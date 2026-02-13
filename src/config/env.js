// src/config/env.js
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Variables de entorno inválidas:');
    parsed.error.issues.forEach(issue => {
        console.error(`  - ${issue.path.join('.') || 'env'}: ${issue.message}`);
    });
    process.exit(1);
}

export const env = parsed.data;