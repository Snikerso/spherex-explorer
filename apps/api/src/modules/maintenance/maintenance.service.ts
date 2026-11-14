import { cleanRemoteStorage } from '../storage/cleanup.js';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Store } from '../../database/store.js';
import { settings } from '../../config.js';
import { cacheRoot } from '../observations/imaging/paths.js';
import { maintainCache } from './cache-usage.js';
import { cleanCache } from './cache-cleanup.js';

const ownedCollections = [
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

@Injectable()
export class MaintenanceService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  constructor(@Inject(Store) private readonly store: Store) {}

  onApplicationBootstrap() {
    if (settings.NODE_ENV === 'test') return;
    void this.run();
    this.timer = setInterval(() => void this.run(), settings.CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
  run(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.sweep()
      .catch((error) => {
        this.logger.error(
          'Session/cache cleanup failed; it will retry on the next interval.',
          error,
        );
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
  private async sweep() {
    const now = new Date();
    // Grace covers requests already authorized before expiry, including long workers.
    const before = new Date(now.getTime() - settings.CACHE_RETENTION_HOURS * 3600000);
    const expired = await this.store
      .collection('sessions')
      .find({ expiresAt: { $lte: before } })
      .project({ sessionId: 1 })
      .limit(100)
      .toArray();
    let sessions = 0;
    for (const session of expired) {
      const sessionId = session.sessionId;
      if (typeof sessionId !== 'string' || !sessionId) continue;
      const busy =
        (await this.store.collection('jobs').findOne({ sessionId, active: true })) ||
        (await this.store.collection('runs').findOne({ sessionId, active: true }));
      if (busy) continue;
      // Keep the session until all child deletes succeed, so partial failures are retried.
      for (const name of ownedCollections)
        await this.store.collection(name).deleteMany({ sessionId });
      await this.store.collection('sessions').deleteOne({ sessionId, expiresAt: { $lte: before } });
      sessions++;
    }
    const removed = await maintainCache(async () => {
      if (
        (await this.store.collection('jobs').findOne({ active: true })) ||
        (await this.store.collection('runs').findOne({ active: true }))
      )
        return 0;
      const sequences = await this.store
        .collection('sequences')
        .find({})
        .project({ id: 1, status: 1 })
        .toArray();
      const localRemoved = await cleanCache(
        cacheRoot,
        new Set(sequences.map((sequence) => sequence.id as string)),
        before,
        new Set(
          sequences
            .filter((sequence) => sequence.status === 'ready')
            .map((sequence) => sequence.id as string),
        ),
      );
      const remoteRemoved = await cleanRemoteStorage(
        sequences.map((sequence) => ({
          id: sequence.id as string,
          status: sequence.status as string,
        })),
        before,
      );
      return localRemoved + remoteRemoved;
    });
    if (sessions || removed)
      this.logger.log(
        `Removed ${sessions} expired sessions and ${removed ?? 0} unused cache entries.`,
      );
  }
}
