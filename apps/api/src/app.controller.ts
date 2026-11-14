import { Body, Controller, Get, Inject, Patch, Post, Req, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { Response } from 'express';
import { manualViewRequestSchema } from '@spherex/contracts';
import { settings } from './config.js';
import { ObservationsService } from './modules/observations/observations.service.js';
import { DomainError, framesShareBand } from '@spherex/contracts';
import { OriginGuard, SessionGuard, type SessionRequest } from './http.js';
import { SessionsService } from './modules/sessions/sessions.service.js';
import { WorkspaceService } from './modules/workspace/workspace.service.js';

@Controller()
export class AppController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
    @Inject(ObservationsService) private readonly observations: ObservationsService,
  ) {}

  @Get('health/live') live() { return { status: 'ok', stage: 'mvp' }; }
  @Get('health/ready') async ready() {
    if (this.connection.readyState !== 1 || !this.connection.db) throw new ServiceUnavailableException('MongoDB niedostępne.');
    await this.connection.db.command({ ping: 1 });
    return { status: 'ok', database: 'connected', dataMode: 'live', stage: 'mvp' };
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
  async patchView(@Req() request: SessionRequest, @Body() body: unknown) {
    const input = manualViewRequestSchema.parse(body);
    const view = await this.workspace.get(request.viewerSessionId);
    if (input.patch.frameIds || input.patch.mode || input.patch.playing || input.patch.selectedPoint) {
      const sequence = view.sequenceId ? await this.observations.getSequence(request.viewerSessionId, view.sequenceId) : null;
      if ((input.patch.playing || input.patch.selectedPoint || input.patch.frameIds?.length) && (!sequence || sequence.status !== 'ready')) throw new DomainError('SEQUENCE_REQUIRED', 'Najpierw przygotuj sekwencję.');
      if (input.patch.frameIds?.some(id => !sequence?.frameIds.includes(id))) throw new DomainError('INVALID_SELECTION', 'Klatka nie należy do sekwencji.');
      if (sequence && input.patch.frameIds && !framesShareBand(sequence, input.patch.frameIds)) throw new DomainError('INVALID_SELECTION', 'Animacja wymaga klatek jednego pasma.');
    }
    if (input.patch.selectedObservationIds) {
      const search = view.searchId ? await this.observations.getSearch(request.viewerSessionId, view.searchId) : null;
      if (input.patch.selectedObservationIds.some(id => !search?.observations.some(item => item.id === id))) throw new DomainError('INVALID_SELECTION', 'Obserwacja nie należy do bieżącego wyniku.');
    }
    return this.workspace.patch(request.viewerSessionId, input.patch, input.expectedRevision, 'user');
  }
}
