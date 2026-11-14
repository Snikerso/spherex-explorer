import { materialize, persistSequence, sequenceInputs } from '../storage/artifacts.js';
import { useCache } from '../maintenance/cache-usage.js';
import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  DomainError,
  MAX_SELECTED_OBSERVATIONS,
  selectCompositeFrames,
  type VideoRenderOptions,
  type AnnotationInput,
  type Observation,
  type SearchInput,
  type SearchResult,
  type Sequence,
  type Job,
} from '@spherex/contracts';
import { Store } from '../../database/store.js';
import { WorkspaceService } from '../workspace/workspace.service.js';
import { IrsaClient } from './irsa.js';
import { resolveTarget } from './resolve-target.js';

import { cacheRoot } from './imaging/paths.js';
import { downloadCutouts } from './imaging/download-cutouts.js';
import { analyzeFits, renderSequence, renderVideo } from './imaging/worker-runner.js';
export { cacheRoot } from './imaging/paths.js';
type StoredSequence = Sequence & { createdAt: Date; searchId?: string };
type StoredSearch = SearchResult & { createdAt: Date };
type StoredJob = Job & { sessionId: string; active: boolean };

@Injectable()
export class ObservationsService implements OnModuleInit, OnModuleDestroy {
  readonly irsa = new IrsaClient();
  private readonly controllers = new Map<string, AbortController>();
  private queue = Promise.resolve();
  constructor(
    @Inject(Store) private readonly store: Store,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
  ) {}
  async onModuleInit() {
    // A single API process owns this local queue. A restart must never leave a job running forever.
    const error = {
      code: 'PROCESS_RESTARTED',
      message: 'Przygotowanie przerwano przez restart API. Uruchom je ponownie.',
    };
    await this.store
      .collection<StoredJob>('jobs')
      .updateMany({ active: true }, { $set: { active: false, status: 'failed', error } });
    await this.store
      .collection<StoredSequence>('sequences')
      .updateMany(
        { status: { $in: ['queued', 'running'] } },
        { $set: { status: 'failed', error } },
      );
  }
  onModuleDestroy() {
    for (const controller of this.controllers.values()) controller.abort();
  }
  async resolveTarget(name: string, signal?: AbortSignal) {
    return resolveTarget(name, signal);
  }
  async search(sessionId: string, input: SearchInput, signal?: AbortSignal): Promise<SearchResult> {
    const observations = await this.irsa.search(input, signal);
    signal?.throwIfAborted();
    const result: StoredSearch = {
      id: randomUUID(),
      sessionId,
      input,
      observations: observations.slice(0, 500),
      dataMode: 'live',
      total: observations.length,
      truncated: observations.length > 500,
      createdAt: new Date(),
      warnings: [
        'Zgodność detektora nie gwarantuje zgodności długości fali. Weryfikacja nastąpi na podstawie FITS.',
      ],
    };
    await this.store.collection<StoredSearch>('searches').insertOne(result);
    return result;
  }
  async getSearch(sessionId: string, id: string) {
    return this.store
      .collection<StoredSearch>('searches')
      .findOne({ id, sessionId }, { projection: { _id: 0 } });
  }
  async getSequence(sessionId: string, id: string) {
    return this.store
      .collection<StoredSequence>('sequences')
      .findOne({ id, sessionId }, { projection: { _id: 0 } });
  }
  async getJob(sessionId: string, id: string) {
    const job = await this.store
      .collection<StoredJob>('jobs')
      .findOne({ id, sessionId }, { projection: { _id: 0 } });
    if (!job) throw new DomainError('RESOURCE_NOT_FOUND', 'Zadanie niedostępne.');
    return job;
  }
  async cancel(sessionId: string, id: string) {
    const job = await this.getJob(sessionId, id);
    if (job.active) {
      await this.store
        .collection<StoredJob>('jobs')
        .updateOne(
          { id, sessionId, active: true },
          { $set: { active: false, status: 'cancelled' } },
        );
      await this.store
        .collection<StoredSequence>('sequences')
        .updateOne({ id: job.sequenceId, sessionId }, { $set: { status: 'cancelled' } });
      this.controllers.get(id)?.abort();
    }
    return this.getJob(sessionId, id);
  }
  async prepare(
    sessionId: string,
    observationIds: string[],
    signal?: AbortSignal,
    multipleBands = false,
  ): Promise<Sequence> {
    signal?.throwIfAborted();
    if (observationIds.length > MAX_SELECTED_OBSERVATIONS)
      throw new DomainError('SELECTION_LIMIT', 'Możesz wybrać maksymalnie 64 zdjęcia łącznie.');
    const view = await this.workspace.get(sessionId);
    const search = view.searchId ? await this.getSearch(sessionId, view.searchId) : null;
    const selected = search?.observations.filter((item) => observationIds.includes(item.id)) ?? [];
    if (
      !search?.input ||
      selected.length !== observationIds.length ||
      selected.length < 2 ||
      selected.length > 500 ||
      new Set(observationIds).size !== observationIds.length ||
      (!multipleBands && new Set(selected.map((item) => item.comparisonGroup)).size !== 1)
    )
      throw new DomainError(
        'INVALID_SELECTION',
        'Wybierz co najmniej 2 obserwacje jednego detektora z bieżącego wyszukiwania.',
      );
    const groups = [...new Set(selected.map((item) => item.comparisonGroup))].map((group) =>
      selected.filter((item) => item.comparisonGroup === group),
    );
    if (
      groups.length > 6 ||
      groups.some((group) => new Set(group.map((item) => item.observedAtUtc)).size < 2)
    )
      throw new DomainError(
        'INVALID_SELECTION',
        'Każde pasmo wymaga co najmniej 2 obserwacji z różnych czasów.',
      );
    const id = randomUUID();
    const jobId = randomUUID();
    const sequence: StoredSequence = {
      id,
      sessionId,
      jobId,
      searchId: search.id,
      status: 'queued',
      observationIds,
      frameIds: [],
      ...(multipleBands
        ? { requestedDetectors: [...new Set(selected.map((item) => item.detector!))].sort() }
        : {}),
      input: search.input,
      createdAt: new Date(),
    };
    try {
      await this.store.collection<StoredJob>('jobs').insertOne({
        id: jobId,
        sessionId,
        sequenceId: id,
        active: true,
        status: 'queued',
        progress: 0,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new DomainError('JOB_IN_PROGRESS', 'Jedna sekwencja jest już przygotowywana.');
      throw error;
    }
    await this.store.collection<StoredSequence>('sequences').insertOne(sequence);
    const controller = new AbortController();
    this.controllers.set(jobId, controller);
    this.queue = this.queue
      .then(() => useCache(() => this.process(sequence, selected, controller.signal)))
      .catch(() => {})
      .finally(() => {
        this.controllers.delete(jobId);
      });
    return sequence;
  }
  async prepareBands(
    sessionId: string,
    searchId: string,
    detectors: string[],
    expectedRevision: number,
    observationIds?: string[],
  ) {
    const current = await this.workspace.get(sessionId);
    if (current.viewRevision !== expectedRevision || current.searchId !== searchId)
      throw new DomainError('VIEW_CONFLICT', 'Wyszukiwanie lub ustawienia zmieniły się.');
    const search = await this.getSearch(sessionId, searchId);
    if (!search) throw new DomainError('RESOURCE_NOT_FOUND', 'Wyszukiwanie niedostępne.');
    const ids: string[] = [];
    for (const detector of detectors) {
      const times = new Set<string>();
      const items = search.observations
        .filter(
          (item) =>
            item.detector === detector && (!observationIds || observationIds.includes(item.id)),
        )
        .sort((a, b) => a.observedAtUtc.localeCompare(b.observedAtUtc));
      const chosen = observationIds
        ? items
        : items.filter((item) => {
            if (times.has(item.observedAtUtc)) return false;
            times.add(item.observedAtUtc);
            return true;
          });
      if (chosen.length < 2)
        throw new DomainError(
          'NO_COMPARABLE_FRAMES',
          `${detector}: brak dwóch różnych czasów obserwacji.`,
        );
      ids.push(...chosen.map((item) => item.id));
    }
    if (ids.length > MAX_SELECTED_OBSERVATIONS)
      throw new DomainError('SELECTION_LIMIT', 'Możesz wybrać maksymalnie 64 zdjęcia łącznie.');
    const selected = await this.workspace.patch(
      sessionId,
      { selectedObservationIds: ids, playing: false },
      expectedRevision,
      'user',
    );
    const sequence = await this.prepare(sessionId, ids, undefined, true);
    try {
      await this.workspace.patch(
        sessionId,
        { jobId: sequence.jobId },
        selected.viewRevision,
        'user',
      );
    } catch (error) {
      await this.cancel(sessionId, sequence.jobId);
      throw error;
    }
    return sequence;
  }
  private async process(
    sequence: StoredSequence,
    observations: Observation[],
    signal: AbortSignal,
  ) {
    const jobs = this.store.collection<StoredJob>('jobs');
    const sequences = this.store.collection<StoredSequence>('sequences');
    const { jobId, sessionId, id } = sequence;
    try {
      signal.throwIfAborted();
      await jobs.updateOne({ id: jobId, active: true }, { $set: { status: 'running' } });
      await sequences.updateOne({ id, status: 'queued' }, { $set: { status: 'running' } });
      const input = sequence.input!;
      const { files, downloadWarnings } = await downloadCutouts(
        observations,
        input,
        signal,
        (progress) => jobs.updateOne({ id: jobId, active: true }, { $max: { progress } }),
      );
      if (files.length < 2)
        throw new DomainError(
          'DATA_SOURCE_ERROR',
          `Pobrano tylko ${files.length} wycinków. ${downloadWarnings[0] ?? 'Wybierz inne obserwacje.'}`,
        );
      const outputDirectory = `sequences/${id}`;
      await mkdir(resolve(cacheRoot, outputDirectory), { recursive: true });
      const manifest = resolve(cacheRoot, outputDirectory, 'request.json');
      await writeFile(
        manifest,
        JSON.stringify({ input, files, outputDirectory, detectors: sequence.requestedDetectors }),
      );
      const result = await renderSequence(manifest, signal);
      await persistSequence(id);
      result.warnings = [...downloadWarnings, ...result.warnings];
      signal.throwIfAborted();
      await sequences.updateOne(
        { id, status: 'running' },
        { $set: { ...result, status: 'ready', frameIds: result.frames.map((frame) => frame.id) } },
      );
      await jobs.updateOne(
        { id: jobId, active: true },
        { $set: { active: false, status: 'ready', progress: 100 } },
      );
      // Only attach to the search which launched this job; never replace a newer search.
      for (let attempt = 0; attempt < 3; attempt++) {
        const view = await this.workspace.get(sessionId);
        if (view.jobId !== jobId) break;
        try {
          await this.workspace.patch(
            sessionId,
            {
              sequenceId: id,
              frameIds:
                result.bands?.find((band) => band.status === 'ready')?.frameIds ??
                result.frames.map((frame) => frame.id),
              playing: false,
              selectedPoint: null,
            },
            view.viewRevision,
            'system',
          );
          break;
        } catch (error) {
          if (!(error instanceof DomainError) || error.code !== 'VIEW_CONFLICT') throw error;
        }
      }
    } catch (cause) {
      const status = signal.aborted ? 'cancelled' : 'failed';
      const error =
        cause instanceof DomainError
          ? { code: cause.code, message: cause.message }
          : {
              code: 'IMAGING_ERROR',
              message:
                'Nie udało się przygotować obrazów. Sprawdź dostępność workera i spróbuj ponownie.',
            };
      await sequences.updateOne(
        { id, status: { $in: ['queued', 'running'] } },
        { $set: { status, error } },
      );
      await jobs.updateOne({ id: jobId, active: true }, { $set: { active: false, status, error } });
    }
  }
  analyze(...args: Parameters<ObservationsService['analyzeWithCache']>) {
    return useCache(() => this.analyzeWithCache(...args));
  }
  private async analyzeWithCache(
    sessionId: string,
    sequenceId: string,
    analysis: {
      kind: 'spectrum' | 'stack' | 'compare' | 'metadata';
      operation?: 'add' | 'subtract';
      observationIds?: string[];
      point?: { raDeg: number; decDeg: number };
      rangeUm: [number, number];
    },
  ) {
    const sequence = await this.getSequence(sessionId, sequenceId);
    if (!sequence || sequence.status !== 'ready')
      throw new DomainError('RESOURCE_NOT_FOUND', 'Gotowa sekwencja niedostępna.');
    const directory = resolve(cacheRoot, 'analyses', randomUUID());
    await mkdir(directory, { recursive: true });
    try {
      const original = JSON.parse(
        await readFile(await sequenceInputs(sequenceId, analysis.observationIds), 'utf8'),
      );
      if (analysis.observationIds) {
        if (!analysis.observationIds.every((id) => sequence.observationIds.includes(id)))
          throw new DomainError('INVALID_SELECTION', 'Obserwacja nie należy do tej sekwencji.');
        original.files = analysis.observationIds.map((id) =>
          original.files.find((item: { observationId: string }) => item.observationId === id),
        );
        if (original.files.some((item: unknown) => !item))
          throw new DomainError('RESOURCE_NOT_FOUND', 'Brak źródłowego FITS w cache.');
      }
      const manifest = resolve(directory, 'request.json');
      await writeFile(manifest, JSON.stringify({ ...original, analysis }));
      return await analyzeFits(manifest);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  exportVideo(...args: Parameters<ObservationsService['exportVideoWithCache']>) {
    return useCache(() => this.exportVideoWithCache(...args));
  }
  private async exportVideoWithCache(
    sessionId: string,
    sequenceId: string,
    frameIds: string[],
    fps: number,
    options?: VideoRenderOptions,
  ) {
    const sequence = await this.getSequence(sessionId, sequenceId);
    if (!sequence || sequence.status !== 'ready')
      throw new DomainError('RESOURCE_NOT_FOUND', 'Gotowa sekwencja jest niedostępna.');
    if (
      new Set(frameIds).size !== frameIds.length ||
      !frameIds.every((id) => sequence.frameIds.includes(id)) ||
      (sequence.bands &&
        !sequence.bands.some(
          (band) => band.status === 'ready' && frameIds.every((id) => band.frameIds.includes(id)),
        ))
    )
      throw new DomainError('INVALID_SELECTION', 'Eksport wymaga klatek jednego gotowego pasma.');
    const directory = resolve(cacheRoot, 'exports', randomUUID());
    await mkdir(directory, { recursive: true });
    try {
      const frames = [];
      for (const id of frameIds) {
        const frame = sequence.frames!.find((item) => item.id === id)!;
        const selected = options?.color
          ? selectCompositeFrames(sequence.frames!, frame.observedAtUtc, options.epochHours)
          : [frame];
        if (
          !selected.length ||
          (options?.color &&
            options.channels.some(
              (channel) =>
                channel.enabled &&
                channel.detector !== 'auto' &&
                !selected.some((source) => source.detector === channel.detector),
            ))
        )
          continue;
        const sources = await Promise.all(
          selected.map(async (source) => ({
            path: await this.framePath(sessionId, sequenceId, source.id, false),
            radiancePath: source.radianceName
              ? await this.radiancePath(sessionId, sequenceId, source.id)
              : undefined,
            detector: source.detector,
          })),
        );
        frames.push({
          sources,
          caption:
            `${frame.observedAtUtc.replace('T', ' ').replace('Z', '')} UTC / ${options?.exposure ?? 0} EV` +
            (options?.color
              ? '\nRGB ' +
                options.channels
                  .map(
                    (channel, index) =>
                      `${['R', 'G', 'B'][index]}=${channel.enabled ? channel.detector.replace('SPHEREx-', '') : 'off'}`,
                  )
                  .join(' ') +
                '\n' +
                selected
                  .map(
                    (source) =>
                      `${source.detector?.replace('SPHEREx-', '')} ${source.wavelengthUm.toFixed(3)}um ${source.observedAtUtc.replace('T', ' ').replace('Z', '')}`,
                  )
                  .join('\n')
              : `\n${frame.detector ?? 'SPHEREx'} / ${frame.wavelengthUm.toFixed(3)} um`),
        });
      }
      if (!frames.length)
        throw new DomainError(
          'INVALID_SELECTION',
          'Brak klatek RGB dla wybranych pasm i okresu. Zwiększ okres lub zmień przypisanie kolorów.',
        );
      const output = resolve(directory, 'sequence.mp4');
      const manifest = resolve(directory, 'request.json');
      await writeFile(
        manifest,
        JSON.stringify({ frames, fps, output, options, size: sequence.grid?.width ?? 256 }),
      );
      await renderVideo(manifest);
      return await readFile(output);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  async radiancePath(sessionId: string, id: string, frameId: string) {
    const sequence = await this.getSequence(sessionId, id);
    const frame =
      sequence?.status === 'ready' ? sequence.frames?.find((item) => item.id === frameId) : null;
    if (!frame?.radianceName)
      throw new DomainError(
        'RESOURCE_NOT_FOUND',
        'Przygotuj obrazy ponownie, aby regulować ekspozycję bez utraty szczegółów.',
      );
    return materialize(`sequences/${sequence!.id}/${frame.radianceName}`);
  }
  async framePath(sessionId: string, id: string, frameId: string, qualityMask = true) {
    const sequence = await this.getSequence(sessionId, id);
    const frame =
      sequence?.status === 'ready' ? sequence.frames?.find((item) => item.id === frameId) : null;
    if (!frame) throw new DomainError('RESOURCE_NOT_FOUND', 'Klatka niedostępna.');
    const name = qualityMask ? frame.imageName : frame.unmaskedImageName;
    if (!name)
      throw new DomainError(
        'VARIANT_UNAVAILABLE',
        'Przygotuj sekwencję ponownie, aby przełączać maskę jakości.',
      );
    return materialize(`sequences/${sequence!.id}/${name}`);
  }
  async saveAnnotation(sessionId: string, input: AnnotationInput, idempotencyKey: string) {
    if (!(await this.getSequence(sessionId, input.sequenceId)))
      throw new DomainError('RESOURCE_NOT_FOUND', 'Sekwencja niedostępna.');
    const id = randomUUID();
    await this.store.collection('annotations').updateOne(
      { sessionId, idempotencyKey },
      {
        $setOnInsert: {
          ...input,
          id,
          sessionId,
          idempotencyKey,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    return (await this.store
      .collection<{ id: string }>('annotations')
      .findOne({ sessionId, idempotencyKey }, { projection: { _id: 0 } }))!;
  }
  async annotations(sessionId: string, sequenceId: string) {
    if (!(await this.getSequence(sessionId, sequenceId)))
      throw new DomainError('RESOURCE_NOT_FOUND', 'Sekwencja niedostępna.');
    return this.store
      .collection('annotations')
      .find({ sessionId, sequenceId }, { projection: { _id: 0, sessionId: 0, idempotencyKey: 0 } })
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();
  }
}
