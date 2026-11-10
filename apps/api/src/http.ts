import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { DomainError } from '@spherex/contracts';
import { ZodError } from 'zod';
import type { Request, Response } from 'express';
import { SessionsService } from './modules/sessions/sessions.service.js';
import { settings } from './config.js';

export type SessionRequest = Request & { viewerSessionId: string };
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SessionsService) private readonly sessions: SessionsService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    request.viewerSessionId = await this.sessions.authorize(request.headers.cookie);
    return true;
  }
}

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.origin !== new URL(settings.APP_ORIGIN).origin) {
      throw new HttpException('Niedozwolony origin.', 403);
    }
    return true;
  }
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof ZodError ? 400 : exception instanceof DomainError ? 409 : exception instanceof HttpException ? exception.getStatus() : 500;
    response.status(status).json({ error: {
      code: exception instanceof ZodError ? 'INVALID_INPUT' : exception instanceof DomainError ? exception.code : `HTTP_${status}`,
      message: status === 500 ? 'Wewnętrzny błąd serwera.' : exception instanceof Error ? exception.message : 'Błąd żądania.',
      retryable: false,
    } });
  }
}
