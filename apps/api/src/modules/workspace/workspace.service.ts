import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { applyViewPatch, DomainError, initialView, type ViewPatch, type ViewState } from '@spherex/contracts';
import type { ViewRecord } from '../../database/models.js';

@Injectable()
export class WorkspaceService {
  constructor(@InjectModel('View') private readonly views: Model<ViewRecord>) {}

  async get(sessionId: string): Promise<ViewState> {
    const document = await this.views.findOneAndUpdate({ sessionId }, {
      $setOnInsert: { sessionId, state: initialView() },
    }, { upsert: true, returnDocument: 'after' }).lean();
    return document!.state;
  }

  async patch(sessionId: string, patch: ViewPatch, expectedRevision: number, source: ViewState['lastChangedBy']): Promise<ViewState> {
    const current = await this.get(sessionId);
    const next = applyViewPatch(current, patch, expectedRevision, source);
    const document = await this.views.findOneAndUpdate({
      sessionId, 'state.viewRevision': expectedRevision,
    }, { $set: { state: next } }, { returnDocument: 'after' }).lean();
    if (!document) throw new DomainError('VIEW_CONFLICT', 'Nowsza zmiana ustawień została już zapisana.');
    return document.state;
  }
}
