import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { viewStateSchema } from '@spherex/contracts';

describe('NestJS + MongoDB replica set', () => {
  let mongo: MongoMemoryReplSet | undefined;
  let app: INestApplication | undefined;
  let base: string;
  const origin = 'http://localhost:5173';
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ binary: { version: '8.0.17' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
    process.env.MONGODB_URI = mongo.getUri('spherex_test');
    process.env.NODE_ENV = 'test'; process.env.APP_ORIGIN = origin;
    const { createApp } = await import('../src/bootstrap.js');
    app = await createApp(); await app.init();
    const connection = app.get<Connection>(getConnectionToken());
    await Promise.all(Object.values(connection.models).map((model) => model.createIndexes()));
    await app.listen(0, '127.0.0.1'); base = `${await app.getUrl()}/api/v1`;
  });
  afterAll(async () => { await app?.close(); await mongo?.stop(); });
  async function session() {
    const response = await fetch(`${base}/sessions`, { method: 'POST', headers: { origin } });
    expect(response.status).toBe(201);
    return response.headers.get('set-cookie')!.split(';')[0]!;
  }
  async function getView(cookie: string) {
    const response = await fetch(`${base}/view`, { headers: { cookie } });
    expect(response.ok).toBe(true); return viewStateSchema.parse(await response.json());
  }
  function patch(cookie: string, revision: number, fps: number) {
    return fetch(`${base}/view`, { method: 'PATCH', headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: revision, patch: { fps } }) });
  }
  it('potwierdza gotowość bazy oraz odrzuca brak sesji i obcy origin', async () => {
    expect((await fetch(`${base}/health/ready`)).status).toBe(200);
    expect((await fetch(`${base}/view`)).status).toBe(401);
    expect((await fetch(`${base}/sessions`, { method: 'POST', headers: { origin: 'https://other.example' } })).status).toBe(403);
  });
  it('zapisuje ręczną poprawkę, odtwarza ją i izoluje sesje', async () => {
    const a = await session(); const b = await session();
    const current = await getView(a);
    expect((await patch(a, current.viewRevision, 1)).status).toBe(200);
    expect((await getView(a)).fps).toBe(1);
    expect((await getView(b)).fps).toBe(2);
    expect((await patch(a, current.viewRevision, 3)).status).toBe(409);
  });
  it('tylko jedna równoległa edycja wygrywa tę samą rewizję', async () => {
    const cookie = await session(); const current = await getView(cookie);
    const responses = await Promise.all([patch(cookie, current.viewRevision, 1), patch(cookie, current.viewRevision, 3)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await getView(cookie)).viewRevision).toBe(1);
  });
  it('indeks blokuje duplikat sesji, a transakcja wycofuje niezatwierdzony zapis', async () => {
    const connection = app!.get<Connection>(getConnectionToken());
    const model = connection.models.View!;
    const cookie = await session(); await getView(cookie);
    const existing = await model.findOne().lean();
    await expect(model.create({ sessionId: existing!.sessionId, state: existing!.state })).rejects.toMatchObject({ code: 11000 });
    const transaction = await connection.startSession();
    try {
      await expect(transaction.withTransaction(async () => {
        await model.create([{ sessionId: 'rolled-back', state: existing!.state }], { session: transaction });
        throw new Error('rollback');
      })).rejects.toThrow('rollback');
      expect(await model.countDocuments({ sessionId: 'rolled-back' })).toBe(0);
    } finally { await transaction.endSession(); }
  });
});
