import { queryNeossat } from './neossat.js';
import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { DomainError, type GaiaResult, type WiseReference } from '@spherex/contracts';
import { OriginGuard, SessionGuard, type SessionRequest } from '../../http.js';
import { ObservationsService } from '../observations/observations.service.js';
import { queryGaia } from './gaia.js';
import { queryWise } from './wise.js';
import { useCache } from '../maintenance/cache-usage.js';

@Controller('catalogs')
@UseGuards(SessionGuard)
export class CatalogsController {
  private readonly gaiaCache = new Map<string, { expires: number; result: Promise<GaiaResult> }>();
  private gaiaRequests = 0;
  private wiseBusy = false;
  private neossatBusy = 0;
  constructor(@Inject(ObservationsService) private readonly observations: ObservationsService) {}
  @Get('gaia')
  async gaia(@Query() query: unknown) {
    const input = z
      .object({
        ra: z.coerce.number().min(0).lt(360),
        dec: z.coerce.number().min(-90).max(90),
        radius: z.coerce.number().min(0.001).max(0.5),
      })
      .strict()
      .parse(query);
    const key = JSON.stringify(input),
      cached = this.gaiaCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.result;
    if (this.gaiaRequests >= 4)
      throw new DomainError('SEARCH_IN_PROGRESS', 'Gaia queries are busy. Please retry.');
    this.gaiaRequests++;
    const result = queryGaia(input.ra, input.dec, input.radius)
      .catch((error) => {
        this.gaiaCache.delete(key);
        throw error;
      })
      .finally(() => {
        this.gaiaRequests--;
      });
    this.gaiaCache.set(key, { result, expires: Date.now() + 600000 });
    if (this.gaiaCache.size > 32) this.gaiaCache.delete(this.gaiaCache.keys().next().value!);
    return result;
  }
  @Get('neossat')
  async neossat(@Query() query: unknown) {
    const input = z
      .object({
        ra: z.coerce.number().min(0).lt(360),
        dec: z.coerce.number().min(-90).max(90),
        radius: z.coerce.number().min(0.001).max(0.5),
        from: z.iso.datetime().optional(),
        to: z.iso.datetime().optional(),
      })
      .strict()
      .refine((value) => !value.from || !value.to || value.from <= value.to)
      .parse(query);
    if (this.neossatBusy >= 2)
      throw new DomainError('SEARCH_IN_PROGRESS', 'CADC queries are busy. Please retry.');
    this.neossatBusy++;
    try {
      return await queryNeossat(input);
    } finally {
      this.neossatBusy--;
    }
  }
  @Post('wise')
  @UseGuards(OriginGuard)
  async wise(@Req() request: SessionRequest, @Body() body: unknown): Promise<WiseReference> {
    const input = z
      .object({ sequenceId: z.string().uuid(), band: z.enum(['W1', 'W2']) })
      .strict()
      .parse(body);
    const sequence = await this.observations.getSequence(request.viewerSessionId, input.sequenceId);
    if (sequence?.status !== 'ready' || !sequence.grid)
      throw new DomainError('RESOURCE_NOT_FOUND', 'Prepared sequence unavailable.');
    if (this.wiseBusy)
      throw new DomainError('SEARCH_IN_PROGRESS', 'WISE rendering is busy. Please retry.');
    this.wiseBusy = true;
    try {
      return await useCache(() => queryWise(sequence.grid!, input.band));
    } finally {
      this.wiseBusy = false;
    }
  }
}
