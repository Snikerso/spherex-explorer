import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Model } from 'mongoose';
import type { SessionRecord } from '../../database/models.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
@Injectable()
export class SessionsService {
  constructor(@InjectModel('Session') private readonly sessions: Model<SessionRecord>) {}

  async create() {
    const token = randomBytes(32).toString('base64url');
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.sessions.create({ tokenHash: hash(token), sessionId, expiresAt });
    return { token, sessionId, expiresAt };
  }

  async authorize(cookie: string | undefined): Promise<string> {
    const token = cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('spherex_session='))?.slice('spherex_session='.length);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new UnauthorizedException('Wymagana sesja.');
    const session = await this.sessions.findOneAndUpdate({
      tokenHash: hash(token), expiresAt: { $gt: new Date() },
    }, { $set: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }, { returnDocument: 'after' }).lean();
    if (!session) throw new UnauthorizedException('Sesja wygasła.');
    return session.sessionId;
  }
}
