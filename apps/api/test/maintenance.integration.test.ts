import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createConnection, type Connection } from 'mongoose';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, utimes, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MaintenanceService } from '../src/modules/maintenance/maintenance.service.js';
let mongo: MongoMemoryReplSet;
let connection: Connection;
let service: MaintenanceService;
let root: string;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ binary: { version: '8.0.17' }, replSet: { count: 1 } });
  root = await mkdtemp(join(tmpdir(), 'spherex-retention-'));
  process.env.MONGODB_URI = mongo.getUri('retention');
  process.env.NODE_ENV = 'test';
  process.env.CACHE_ROOT = root;
  connection = await createConnection(process.env.MONGODB_URI).asPromise();
  const { Store } = await import('../src/database/store.js');
  const { MaintenanceService } = await import('../src/modules/maintenance/maintenance.service.js');
  service = new MaintenanceService(new Store(connection));
});
afterAll(async () => {
  await connection?.close();
  await mongo?.stop();
  if (root) await rm(root, { recursive: true, force: true });
});
it('cascades expired ownership, retains active/recent sessions, sweeps orphan cache and is idempotent', async () => {
  const db = connection.db!;
  const old = new Date('2020-01-01');
  await db.collection('sessions').insertMany([
    { sessionId: 'expired', expiresAt: old },
    { sessionId: 'active-job', expiresAt: old },
    { sessionId: 'active-agent', expiresAt: old },
    { sessionId: 'grace', expiresAt: new Date(Date.now() - 3600000) },
    { sessionId: 'live', expiresAt: new Date(Date.now() + 86400000) },
  ]);
  const collections = [
    'views',
    'searches',
    'sequences',
    'jobs',
    'annotations',
    'runs',
    'messages',
    'runEvents',
    'histories',
    'historyItems',
    'shares',
  ];
  for (const name of collections)
    await db.collection(name).insertMany([
      { sessionId: 'expired', id: 'gone' },
      { sessionId: 'live', id: 'keep' },
    ]);
  await db.collection('jobs').insertOne({ sessionId: 'active-job', active: true });
  await db.collection('runs').insertOne({ sessionId: 'active-agent', active: true });
  await mkdir(join(root, 'sequences/gone'), { recursive: true });
  await writeFile(join(root, 'sequences/gone/frame.png'), 'old');
  await utimes(join(root, 'sequences/gone'), old, old);
  await service.run();
  for (const name of collections) {
    expect(await db.collection(name).countDocuments({ sessionId: 'expired' })).toBe(0);
    expect(await db.collection(name).countDocuments({ sessionId: 'live' })).toBe(1);
  }
  expect(await db.collection('sessions').countDocuments()).toBe(4);
  // Cache is deferred while either a job or agent is active.
  await expect(access(join(root, 'sequences/gone'))).resolves.toBeUndefined();
  await db.collection('jobs').updateMany({}, { $set: { active: false } });
  await db.collection('runs').updateMany({}, { $set: { active: false } });
  await service.run();
  await service.run();
  expect(await db.collection('sessions').countDocuments()).toBe(2);
  await expect(access(join(root, 'sequences/gone'))).rejects.toThrow();
});
