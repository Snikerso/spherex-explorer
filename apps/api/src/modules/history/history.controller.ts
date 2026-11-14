import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { OriginGuard, SessionGuard, type SessionRequest } from '../../http.js';
import { HistoryService } from './history.service.js';
@Controller('search-history')
@UseGuards(SessionGuard)
export class HistoryController {
  constructor(@Inject(HistoryService) private readonly history: HistoryService) {}
  @Get() list(@Req() request: SessionRequest, @Query('cursor') cursor: unknown) {
    return this.history.list(request.viewerSessionId, z.string().max(512).optional().parse(cursor));
  }
  @Post(':id/restore')
  @HttpCode(200)
  @UseGuards(OriginGuard)
  restore(@Req() request: SessionRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = z
      .object({ expectedRevision: z.number().int().nonnegative() })
      .strict()
      .parse(body);
    return this.history.restore(
      request.viewerSessionId,
      z.string().uuid().parse(id),
      input.expectedRevision,
    );
  }
}
