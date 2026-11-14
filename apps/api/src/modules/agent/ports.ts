import type { SearchInput, ViewPatch, ViewState } from '@spherex/contracts';

export interface WorkspacePort {
  get(sessionId: string): Promise<ViewState>;
  patch(sessionId: string, patch: ViewPatch, expectedRevision: number, source: ViewState['lastChangedBy']): Promise<ViewState>;
}
export type { Target, Observation, SearchResult, Sequence, AnnotationInput } from '@spherex/contracts';
import type { Target, SearchResult, Sequence, AnnotationInput } from '@spherex/contracts';
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
