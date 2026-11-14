import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection, mongo } from 'mongoose';
import { settings } from '../config.js';

export async function createIndexes(connection: Connection) {
  const db = connection.db!;
  await db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ sessionId: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ expiresAt: 1 });
  await db.collection('views').createIndex({ sessionId: 1 }, { unique: true });
  for (const name of ['searches', 'sequences', 'jobs', 'annotations', 'runs', 'messages']) {
    await db.collection(name).createIndex({ id: 1 }, { unique: true });
    await db.collection(name).createIndex({ sessionId: 1, createdAt: -1 });
  }
  for (const name of ['jobs', 'runs']) await db.collection(name).createIndex({ sessionId: 1 }, { unique: true, partialFilterExpression: { active: true } });
  await db.collection('searches').createIndex({ sessionId: 1, createdAt: -1, id: -1 });
  await db.collection('sequences').createIndex({ sessionId: 1, searchId: 1, createdAt: -1 });
  await db.collection('jobs').createIndex({ status: 1, leaseUntil: 1, createdAt: 1 });
  await db.collection('annotations').createIndex({ sessionId: 1, idempotencyKey: 1 }, { unique: true });
  await db.collection('runs').createIndex({ sessionId: 1, clientRequestId: 1 }, { unique: true });
  await db.collection('runEvents').createIndex({ runId: 1, seq: 1 }, { unique: true });
  await db.collection('runEvents').createIndex({ sessionId: 1 });
  await db.collection('histories').createIndex({ sessionId: 1 }, { unique: true });
  await db.collection('historyItems').createIndex({ sessionId: 1, position: 1 }, { unique: true });
  await db.collection('shares').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('shares').createIndex({ sessionId: 1 });
}

@Injectable()
export class Store implements OnModuleInit {
  constructor(@InjectConnection() readonly connection: Connection) {}
  collection<T extends mongo.Document>(name: string) { return this.connection.db!.collection<T>(name); }
  async onModuleInit() { if (settings.NODE_ENV !== 'production') await createIndexes(this.connection); }
}
