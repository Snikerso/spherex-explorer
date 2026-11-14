import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  DomainError,
  type SearchInput,
  type SearchResult,
  type Sequence,
  type SearchHistoryEntry,
  type SearchHistoryPage,
} from '@spherex/contracts';
import { Store } from '../../database/store.js';
import { WorkspaceService } from '../workspace/workspace.service.js';
import { TARGETS } from '../observations/targets.js';
type Search = SearchResult & {
  input: SearchInput;
  createdAt: Date;
  targetId?: string | null;
};
type Prepared = Sequence & { createdAt: Date; searchId?: string };
const cursorSchema = z.object({ at: z.iso.datetime(), id: z.string().uuid() }).strict();
function targetFor(search: Search) {
  return TARGETS.find(
    (target) =>
      target.id === search.targetId ||
      (Math.abs(target.raDeg - search.input.raDeg) < 1e-7 &&
        Math.abs(target.decDeg - search.input.decDeg) < 1e-7),
  );
}
function matches(sequence: Prepared, search: Search) {
  if (sequence.searchId) return sequence.searchId === search.id;
  const a = sequence.input,
    b = search.input;
  const observationIds = new Set(search.observations.map((observation) => observation.id));
  return Boolean(
    a &&
    ['raDeg', 'decDeg', 'fovDeg', 'fromUtc', 'toUtc', 'release'].every(
      (key) => a[key as keyof typeof a] === b[key as keyof typeof b],
    ) &&
    sequence.observationIds.every((id) => observationIds.has(id)),
  );
}
@Injectable()
export class HistoryService {
  constructor(
    @Inject(Store) private readonly store: Store,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
  ) {}
  private async sequences(sessionId: string, searches: Search[]) {
    return this.store
      .collection<Prepared>('sequences')
      .find(
        {
          sessionId,
          $or: [
            { searchId: { $in: searches.map((search) => search.id) } },
            { searchId: { $exists: false } },
          ],
        },
        { projection: { _id: 0, frames: 0, grid: 0, warnings: 0, stretch: 0 } },
      )
      .sort({ createdAt: -1, id: -1 })
      .toArray();
  }
  private choose(sequences: Prepared[], search: Search) {
    const candidates = sequences.filter((sequence) => matches(sequence, search));
    return candidates.find((sequence) => sequence.status === 'ready') ?? candidates[0];
  }
  async list(sessionId: string, cursor?: string): Promise<SearchHistoryPage> {
    let after: z.infer<typeof cursorSchema> | undefined;
    if (cursor) {
      try {
        after = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
      } catch {
        throw new DomainError('INVALID_SELECTION', 'Invalid history cursor.');
      }
    }
    const query = {
      sessionId,
      ...(after
        ? {
            $or: [
              { createdAt: { $lt: new Date(after.at) } },
              { createdAt: new Date(after.at), id: { $lt: after.id } },
            ],
          }
        : {}),
    };
    const rows = await this.store
      .collection<Search>('searches')
      .find(query)
      .sort({ createdAt: -1, id: -1 })
      .limit(31)
      .toArray();
    const searches = rows.slice(0, 30),
      sequences = await this.sequences(sessionId, searches);
    const entries: SearchHistoryEntry[] = searches.map((search) => {
      const sequence = this.choose(sequences, search);
      return {
        id: search.id,
        createdAt: new Date(search.createdAt).toISOString(),
        targetName: targetFor(search)?.name ?? null,
        input: search.input,
        count: search.observations.length,
        total: search.total ?? search.observations.length,
        truncated: search.truncated ?? false,
        sequence: sequence
          ? {
              id: sequence.id,
              status: sequence.status,
              frames: sequence.frameIds?.length ?? 0,
              detectors:
                sequence.requestedDetectors ?? sequence.bands?.map((band) => band.detector) ?? [],
            }
          : null,
      };
    });
    const last = searches.at(-1);
    return {
      entries,
      nextCursor:
        rows.length > 30 && last
          ? Buffer.from(
              JSON.stringify({ at: new Date(last.createdAt).toISOString(), id: last.id }),
            ).toString('base64url')
          : null,
    };
  }
  async restore(sessionId: string, id: string, expectedRevision: number) {
    if (
      (await this.store.collection('jobs').findOne({ sessionId, active: true })) ||
      (await this.store.collection('runs').findOne({ sessionId, active: true }))
    )
      throw new DomainError('JOB_IN_PROGRESS', 'Stop the active task before restoring history.');
    const search = await this.store.collection<Search>('searches').findOne({ sessionId, id });
    if (!search) throw new DomainError('RESOURCE_NOT_FOUND', 'Search history entry unavailable.');
    const sequence = this.choose(await this.sequences(sessionId, [search]), search);
    const ready = sequence?.status === 'ready' ? sequence : null;
    return this.workspace.patch(
      sessionId,
      {
        searchId: id,
        searchRequestId: randomUUID(),
        searchInput: search.input,
        targetId: targetFor(search)?.id ?? null,
        selectedObservationIds: ready?.observationIds ?? search.observations.map((item) => item.id),
        sequenceId: ready?.id ?? null,
        jobId: null,
        frameIds: ready
          ? (ready.bands?.find((band) => band.status === 'ready')?.frameIds ?? ready.frameIds)
          : [],
        mode: 'blink',
        playing: false,
        selectedPoint: null,
        zoom: 1,
        panX: 0,
        panY: 0,
      },
      expectedRevision,
      'user',
    );
  }
}
