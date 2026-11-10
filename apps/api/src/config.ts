import './load-env.js';
import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//, 'Ustaw MONGODB_URI z MongoDB Atlas w lokalnym pliku .env.'),
  DATA_MODE: z.enum(['demo', 'live']).default('demo'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  AGENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),
  AGENT_MAX_TURNS: z.coerce.number().int().min(1).max(12).default(8),
});
export const settings = configSchema.parse(process.env);
