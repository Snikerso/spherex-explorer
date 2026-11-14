import { SpacecraftOrbitProvider } from './modules/observations/orbit.js';
import { releaseCatalog } from './modules/observations/releases.js';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DomainError, pointSchema, searchInputSchema } from '@spherex/contracts';
import { OriginGuard, SessionGuard, type SessionRequest } from './http.js';
import { ObservationsService } from './modules/observations/observations.service.js';
import { WorkspaceService } from './modules/workspace/workspace.service.js';
import { AgentActions } from './modules/agent/actions.js';
import { AgentService } from './modules/agent/agent.service.js';
import { TARGETS } from './modules/observations/targets.js';

@Controller()
@UseGuards(SessionGuard)
export class ExplorerController {
  private readonly spacecraftOrbit = new SpacecraftOrbitProvider();
  @Get('spacecraft-orbit') orbit() { return this.spacecraftOrbit.get(); }
  private readonly searches = new Set<string>();
  constructor(@Inject(ObservationsService) private readonly observations: ObservationsService, @Inject(WorkspaceService) private readonly workspace: WorkspaceService, @Inject(AgentService) private readonly agent: AgentService) {}
  private async actions(sessionId: string, expectedRevision: number, signal?: AbortSignal) {
    return new AgentActions(this.workspace, this.observations, { sessionId, runId: randomUUID(), expectedRevision, source: 'user', signal });
  }
  @Get('data-releases') releases() { return releaseCatalog(); }
  @Get('targets') targets() { return TARGETS; }
  @Get('capabilities') capabilities() { return { dataMode: 'live', agent: this.agent.available, imaging: true }; }
  @Post('observation-searches') @UseGuards(OriginGuard)
  async search(@Req() request: SessionRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = z.object({ input: searchInputSchema, targetId: z.string().max(200).nullable(), expectedRevision: z.number().int().nonnegative() }).strict().parse(body);
    const sessionId = request.viewerSessionId;
    if (this.searches.has(sessionId)) throw new DomainError('SEARCH_IN_PROGRESS', 'Wyszukiwanie już trwa.');
    this.searches.add(sessionId);
    const controller = new AbortController(); const disconnect = () => controller.abort();
    response.on('close', disconnect);
    try { return await (await this.actions(sessionId, input.expectedRevision, controller.signal)).searchObservations(input); }
    finally { response.off('close', disconnect); this.searches.delete(sessionId); }
  }
  @Get('observation-searches/:id') async getSearch(@Req() request: SessionRequest, @Param('id') id: string) {
    const result = await this.observations.getSearch(request.viewerSessionId, id);
    if (!result) throw new DomainError('RESOURCE_NOT_FOUND', 'Wyszukiwanie niedostępne.');
    return result;
  }
  @Post('sequences') @HttpCode(202) @UseGuards(OriginGuard)
  async prepare(@Req() request: SessionRequest, @Body() body: unknown) {
    const input = z.object({ searchId: z.string().uuid(), observationIds: z.array(z.string().min(1).max(200)).min(2).max(64), expectedRevision: z.number().int().nonnegative() }).strict().parse(body);
    return (await this.actions(request.viewerSessionId, input.expectedRevision)).prepareSequence(input);
  }
  @Post('band-sequences') @HttpCode(202) @UseGuards(OriginGuard)
  async prepareBands(@Req() request: SessionRequest, @Body() body: unknown) {
    const input = z.object({ searchId: z.string().uuid(), detectors: z.array(z.enum(['SPHEREx-D1', 'SPHEREx-D2', 'SPHEREx-D3', 'SPHEREx-D4', 'SPHEREx-D5', 'SPHEREx-D6'])).min(1).max(6).refine(items => new Set(items).size === items.length), observationIds: z.array(z.string().min(1).max(200)).min(2).max(64).optional(), expectedRevision: z.number().int().nonnegative() }).strict().parse(body);
    return this.observations.prepareBands(request.viewerSessionId, input.searchId, input.detectors, input.expectedRevision, input.observationIds);
  }
  @Post('sequences/:id/analyze') @HttpCode(200) @UseGuards(OriginGuard)
  async analyze(@Req() request: SessionRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = z.object({ kind: z.enum(['spectrum', 'stack', 'compare', 'metadata']), operation: z.enum(['add', 'subtract']).optional(), observationIds: z.array(z.string().min(1).max(200)).min(1).max(2).optional(), point: z.object({ raDeg: z.number().min(0).lt(360), decDeg: z.number().min(-90).max(90) }).strict().optional(), rangeUm: z.tuple([z.number().min(.7).max(5.1), z.number().min(.7).max(5.1)]).refine(range => range[0] < range[1]) }).strict().refine(input => input.kind === 'compare' ? Boolean(input.operation && input.observationIds?.length === 2 && input.observationIds[0] !== input.observationIds[1]) : input.kind !== 'metadata' || input.observationIds?.length === 1).parse(body);
    return this.observations.analyze(request.viewerSessionId, id, input);
  }
  @Post('sequences/:id/export') @HttpCode(200) @UseGuards(OriginGuard)
  async exportVideo(@Req() request: SessionRequest, @Param('id') id: string, @Body() body: unknown, @Res() response: Response) {
    const input = z.object({ frameIds: z.array(z.string().uuid()).min(1).max(500), fps: z.number().min(.25).max(4), options: z.object({ color: z.boolean(), exposure: z.number().min(-6).max(2), epochHours: z.number().int().min(1).max(168), channels: z.array(z.object({ enabled: z.boolean(), detector: z.enum(['auto', 'SPHEREx-D1', 'SPHEREx-D2', 'SPHEREx-D3', 'SPHEREx-D4', 'SPHEREx-D5', 'SPHEREx-D6']) }).strict()).length(3) }).strict().optional() }).strict().parse(body);
    const video = await this.observations.exportVideo(request.viewerSessionId, id, input.frameIds, input.fps, ...(input.options ? [input.options] : []));
    response.type('video/mp4').attachment(`spherex-${input.options?.color ? 'rgb-' : ''}${id}.mp4`).send(video);
  }
  @Get('sequences/:id') async sequence(@Req() request: SessionRequest, @Param('id') id: string) {
    const result = await this.observations.getSequence(request.viewerSessionId, id);
    if (!result) throw new DomainError('RESOURCE_NOT_FOUND', 'Sekwencja niedostępna.');
    return result;
  }
  @Get('jobs/:id') job(@Req() request: SessionRequest, @Param('id') id: string) { return this.observations.getJob(request.viewerSessionId, id); }
  @Post('jobs/:id/cancel') @UseGuards(OriginGuard)
  cancelJob(@Req() request: SessionRequest, @Param('id') id: string) { return this.observations.cancel(request.viewerSessionId, id); }
  @Get('sequences/:id/frames/:frameId/radiance')
  async radiance(@Req() request: SessionRequest, @Param('id') id: string, @Param('frameId') frameId: string, @Res() response: Response) {
    const path = await this.observations.radiancePath(request.viewerSessionId, id, frameId);
    response.setHeader('Cache-Control', 'private, max-age=3600'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.type('application/octet-stream').sendFile(path);
  }
  @Get('sequences/:id/frames/:frameId')
  async frame(@Req() request: SessionRequest, @Param('id') id: string, @Param('frameId') frameId: string, @Query('quality') quality: unknown, @Res() response: Response) {
    const variant = z.enum(['on', 'off']).default('on').parse(quality);
    const path = await this.observations.framePath(request.viewerSessionId, id, frameId, variant === 'on');
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff'); response.type('png');
    response.sendFile(path);
  }
  @Post('annotations') @UseGuards(OriginGuard)
  async annotate(@Req() request: SessionRequest, @Body() body: unknown) {
    const { expectedRevision, ...input } = pointSchema.extend({ sequenceId: z.string().uuid(), text: z.string().trim().min(1).max(2000), expectedRevision: z.number().int().nonnegative() }).strict().parse(body);
    return (await this.actions(request.viewerSessionId, expectedRevision)).saveAnnotation(input);
  }
  @Get('sequences/:id/annotations') annotations(@Req() request: SessionRequest, @Param('id') id: string) { return this.observations.annotations(request.viewerSessionId, id); }
  @Get('messages') messages(@Req() request: SessionRequest) { return this.agent.messages(request.viewerSessionId); }
  @Get('agent/runs/current') currentRun(@Req() request: SessionRequest) { return this.agent.active(request.viewerSessionId); }
  @Post('agent/runs') @HttpCode(202) @UseGuards(OriginGuard)
  async run(@Req() request: SessionRequest, @Body() body: unknown) {
    const input = z.object({ message: z.string().trim().min(1).max(4000), clientRequestId: z.string().uuid() }).strict().parse(body);
    return this.agent.start(request.viewerSessionId, input.message, input.clientRequestId);
  }
  @Post('agent/runs/:id/cancel') @UseGuards(OriginGuard)
  cancelRun(@Req() request: SessionRequest, @Param('id') id: string) { return this.agent.cancel(request.viewerSessionId, id); }
  @Get('agent/runs/:id/events')
  async events(@Req() request: SessionRequest, @Param('id') id: string, @Res() response: Response) {
    await this.agent.get(request.viewerSessionId, id);
    const last = request.headers['last-event-id'];
    let after = typeof last === 'string' && last.startsWith(`${id}:`) ? Number(last.slice(id.length + 1)) : 0;
    if (!Number.isSafeInteger(after) || after < 0) after = 0;
    response.setHeader('Content-Type', 'text/event-stream'); response.setHeader('Cache-Control', 'no-cache, no-transform'); response.setHeader('X-Accel-Buffering', 'no'); response.flushHeaders();
    let closed = false; let working = false; let ticks = 0;
    const tick = async () => {
      if (closed || working) return; working = true;
      try {
        const events = await this.agent.events(request.viewerSessionId, id, after);
        for (const event of events) {
          if (closed) break;
          response.write(`id: ${id}:${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`); after = event.seq;
          if (['run.completed', 'run.failed', 'run.cancelled'].includes(event.type)) { closed = true; clearInterval(timer); response.end(); break; }
        }
        if (!closed && events.length === 0 && !(await this.agent.get(request.viewerSessionId, id)).active) { closed = true; clearInterval(timer); response.end(); }
        if (!closed && ++ticks % 30 === 0) response.write(': heartbeat\n\n');
      } catch { closed = true; clearInterval(timer); response.end(); }
      finally { working = false; }
    };
    const timer = setInterval(() => { void tick(); }, 500);
    response.on('close', () => { closed = true; clearInterval(timer); });
    await tick();
  }
}
