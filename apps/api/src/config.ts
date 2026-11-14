import './load-env.js';
import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//, 'Ustaw MONGODB_URI z MongoDB Atlas w lokalnym pliku .env.'),
  DATA_MODE: z.enum(['demo', 'live']).default('live'),
  CLEANUP_INTERVAL_MS: z.coerce.number().int().min(60000).default(3600000),
  CACHE_RETENTION_HOURS: z.coerce.number().min(24).default(24),
  SPACES_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/).optional(),
  SPACES_REGION: z.string().regex(/^[a-z]{3}[1-9]$/).optional(),
  SPACES_ACCESS_KEY_ID: z.string().min(1).optional(),
  SPACES_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  SPACES_PREFIX: z.string().regex(/^[a-zA-Z0-9_/-]+\/$/).default('spherex/v1/'),
  SPACES_FITS_RETENTION_DAYS: z.coerce.number().int().min(7).default(90),
  CACHE_ROOT: z.string().optional(),
  IMAGING_PYTHON: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),
  AGENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),
  AGENT_MAX_TURNS: z.coerce.number().int().min(1).max(12).default(8),
});
export const settings = configSchema.superRefine((value, ctx) => {
  const fields=['SPACES_BUCKET','SPACES_REGION','SPACES_ACCESS_KEY_ID','SPACES_SECRET_ACCESS_KEY'] as const;
  if(fields.some(field=>value[field]))for(const field of fields)if(!value[field])ctx.addIssue({code:'custom',path:[field],message:'Complete Spaces configuration is required.'});
}).parse(process.env);
