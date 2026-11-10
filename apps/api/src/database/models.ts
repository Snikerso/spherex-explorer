import { Schema } from 'mongoose';
import { randomUUID } from 'node:crypto';
import type { ViewState } from '@spherex/contracts';

export interface SessionRecord { _id: string; tokenHash: string; sessionId: string; expiresAt: Date; }
export const sessionSchema = new Schema<SessionRecord>({
  _id: { type: String, default: () => randomUUID() },
  tokenHash: { type: String, required: true },
  sessionId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, collection: 'sessions', autoIndex: false });
sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ sessionId: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 });

export interface ViewRecord { _id: string; sessionId: string; state: ViewState; }
export const viewSchema = new Schema<ViewRecord>({
  _id: { type: String, default: () => randomUUID() },
  sessionId: { type: String, required: true },
  state: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true, collection: 'views', autoIndex: false });
viewSchema.index({ sessionId: 1 }, { unique: true });
