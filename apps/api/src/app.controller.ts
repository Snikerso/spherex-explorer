import { Body, Controller, Get, Inject, Patch, Post, Req, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import type { Response } from 'express';
import { manualViewRequestSchema } from '@spherex/contracts';
import { settings } from './config.js';
import { OriginGuard, SessionGuard, type SessionRequest } from './http.js';
import { SessionsService } from './modules/sessions/sessions.service.js';
import { WorkspaceService } from './modules/workspace/workspace.service.js';

@Controller()
export class AppController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
  ) {}

  @Get('health/live') live() { return { status: 'ok', stage: 'scaffold' }; }
  @Get('health/ready') async ready() {
    if (this.connection.readyState !== 1 || !this.connection.db) throw new ServiceUnavailableException('MongoDB niedostępne.');
    await this.connection.db.command({ ping: 1 });
    return { status: 'ok', database: 'connected', dataMode: settings.DATA_MODE, stage: 'scaffold' };
  }
  @Post('sessions') @UseGuards(OriginGuard)
  async createSession(@Res({ passthrough: true }) response: Response) {
    const { token, sessionId, expiresAt } = await this.sessions.create();
    response.cookie('spherex_session', token, {
      httpOnly: true, sameSite: 'lax', secure: settings.NODE_ENV === 'production',
      path: '/api', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { sessionId, expiresAt };
  }
  @Get('view') @UseGuards(SessionGuard)
  view(@Req() request: SessionRequest) { return this.workspace.get(request.viewerSessionId); }
  @Patch('view') @UseGuards(OriginGuard, SessionGuard)
  patchView(@Req() request: SessionRequest, @Body() body: unknown) {
    const input = manualViewRequestSchema.parse(body);
    return this.workspace.patch(request.viewerSessionId, input.patch, input.expectedRevision, 'user');
  }
}
