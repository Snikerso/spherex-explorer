import type { SearchInput, ViewPatch, ViewState } from '@spherex/contracts';

export interface WorkspacePort {
  get(sessionId: string): Promise<ViewState>;
  patch(sessionId: string, patch: ViewPatch, expectedRevision: number, source: ViewState['lastChangedBy']): Promise<ViewState>;
}
export interface Target { id: string; name: string; raDeg: number; decDeg: number; sourceUrl: string; }
export interface Observation { id: string; observedAtUtc: string; comparisonGroup: string; }
export interface SearchResult { id: string; sessionId: string; observations: Observation[]; dataMode: 'demo' | 'live'; }
export interface Sequence {
  id: string; sessionId: string; observationIds: string[]; frameIds: string[];
  status: 'queued' | 'ready'; jobId: string;
}
export interface AnnotationInput {
  sequenceId: string; raDeg: number; decDeg: number; text: string;
}
export interface ObservationPort {
  resolveTarget(name: string, signal?: AbortSignal): Promise<Target | null>;
  search(sessionId: string, input: SearchInput, signal?: AbortSignal): Promise<SearchResult>;
  getSearch(sessionId: string, id: string): Promise<SearchResult | null>;
  prepare(sessionId: string, observationIds: string[], signal?: AbortSignal): Promise<Sequence>;
  getSequence(sessionId: string, id: string): Promise<Sequence | null>;
  saveAnnotation(sessionId: string, input: AnnotationInput, idempotencyKey: string): Promise<{ id: string }>;
}
export interface ToolCall { name: string; arguments: unknown; }
export interface ViewUpdate { state: ViewState; changedFields: string[]; }
