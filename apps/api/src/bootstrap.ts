import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ApiErrorFilter } from './http.js';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiErrorFilter());
  app.enableShutdownHooks();
  return app;
}
