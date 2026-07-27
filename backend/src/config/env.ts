import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  MONGODB_URI: z.string().min(1, 'MongoDB URI is required'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform(val =>
      val
        .replace(/[\[\]]/g, '')
        .split(',')
        .filter(Boolean)
    ),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export const env = envSchema.parse(process.env);
