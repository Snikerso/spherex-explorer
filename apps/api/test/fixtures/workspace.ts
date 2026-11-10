import { randomUUID } from 'node:crypto';
import { applyViewPatch, initialView, type SearchInput, type ViewPatch, type ViewState } from '@spherex/contracts';
import type { AnnotationInput, ObservationPort, SearchResult, Sequence, Target, WorkspacePort } from '../../src/modules/agent/ports.js';

export class MemoryWorkspace implements WorkspacePort {
  private readonly values = new Map<string, ViewState>();
  async get(id: string) { return structuredClone(this.values.get(id) ?? initialView()); }
  async patch(id: string, patch: ViewPatch, revision: number, source: ViewState['lastChangedBy']) {
    const next = applyViewPatch(this.values.get(id) ?? initialView(), patch, revision, source);
    this.values.set(id, next);
    return structuredClone(next);
  }
}

export const demoTarget: Target = {
  id: 'wise-0855', name: 'WISE 0855', raDeg: 133.79512917, decDeg: -7.24514722,
  sourceUrl: 'https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/',
};
export const demoSearchInput: SearchInput = {
  raDeg: demoTarget.raDeg, decDeg: demoTarget.decDeg, fovDeg: 0.1,
  fromUtc: null, toUtc: null, release: 'qr3',
};
// Syntetyczne identyfikatory i daty do testów. To nie jest manifest danych IRSA.
export class FixtureObservations implements ObservationPort {
  readonly searches = new Map<string, SearchResult>();
  readonly sequences = new Map<string, Sequence>();
  readonly annotations = new Map<string, AnnotationInput & { sessionId: string; id: string }>();
  empty = false;
  unavailable = false;
  async resolveTarget(name: string) { return ['wise 0855', 'wise-0855'].includes(name.toLowerCase()) ? demoTarget : null; }
  async search(sessionId: string, _input: SearchInput, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (this.unavailable) throw new Error('Symulowana niedostępność źródła');
    const result: SearchResult = { id: randomUUID(), sessionId, dataMode: 'demo', observations: this.empty ? [] : [
      { id: 'demo-epoch-b', observedAtUtc: '2025-12-17T00:00:00Z', comparisonGroup: 'demo-qr3-same-wave' },
      { id: 'demo-epoch-a', observedAtUtc: '2025-06-19T00:00:00Z', comparisonGroup: 'demo-qr3-same-wave' },
      { id: 'demo-other-band', observedAtUtc: '2025-08-20T00:00:00Z', comparisonGroup: 'demo-other-wave' },
    ] };
    this.searches.set(result.id, result);
    return structuredClone(result);
  }
  async getSearch(sessionId: string, id: string) {
    const value = this.searches.get(id); return value?.sessionId === sessionId ? structuredClone(value) : null;
  }
  async prepare(sessionId: string, observationIds: string[], signal?: AbortSignal) {
    signal?.throwIfAborted();
    const sequence: Sequence = {
      id: randomUUID(), sessionId, observationIds, frameIds: observationIds.map((id) => `frame-${id}`),
      status: 'ready', jobId: randomUUID(),
    };
    this.sequences.set(sequence.id, sequence); return structuredClone(sequence);
  }
  async getSequence(sessionId: string, id: string) {
    const value = this.sequences.get(id); return value?.sessionId === sessionId ? structuredClone(value) : null;
  }
  async saveAnnotation(sessionId: string, input: AnnotationInput, key: string) {
    const existing = this.annotations.get(`${sessionId}:${key}`);
    if (existing) return { id: existing.id };
    const id = randomUUID();
    this.annotations.set(`${sessionId}:${key}`, { ...input, id, sessionId });
    return { id };
  }
}
