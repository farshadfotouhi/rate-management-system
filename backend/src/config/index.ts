import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  
  DATABASE_URL: z.string(),
  DATABASE_POOL_SIZE: z.string().default('20').transform(Number),
  
  PINECONE_API_KEY: z.string(),
  PINECONE_ENVIRONMENT: z.string(),
  PINECONE_INDEX_NAME: z.string().default('rate-contracts'),
  
  PINECONE_ASSISTANT_API_KEY: z.string(),
  PINECONE_ASSISTANT_MODEL: z.string().default('gemini-2.5-pro'),
  
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  S3_BUCKET_NAME: z.string().optional(),
  
  REDIS_URL: z.string().optional(),
  
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform(val => val ? Number(val) : undefined),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@ratemanagement.com'),
  
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs/app.log'),
  
  MAX_FILE_SIZE_MB: z.string().default('50').transform(Number),
  ALLOWED_FILE_TYPES: z.string().default('application/pdf'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const config = parsed.data;

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';