import type { SearchInput, ViewState } from './index.js';

export interface Target {
  id: string; name: string; raDeg: number; decDeg: number; sourceUrl: string;
  description?: string; epoch?: string; aliases?: string[];
}
export interface Observation {
  id: string; observedAtUtc: string; comparisonGroup: string;
  sourceId?: string; sourceUrl?: string; detector?: string; release?: string;
  spectralRangeUm?: [number, number]; exposureSeconds?: number;
  qualityFlags?: string[]; originalMjd?: number; calibrationVersion?: string;
}
export interface SearchResult {
  id: string; sessionId: string; observations: Observation[]; dataMode: 'demo' | 'live';
  input?: SearchInput; truncated?: boolean; total?: number; warnings?: string[];
}
export interface RenderFrame {
  qualityBits?: { bit: number; name: string; description: string; pixels: number; fraction: number }[];
  radianceName?: string;
  detector?: string;
  id: string; observationId: string; observedAtUtc: string;
  wavelengthUm: number; bandwidthUm: number; coverage: number;
  unmaskedCoverage?: number; unmaskedImageName?: string;
  flaggedFraction: number; imageName: string; sourceUrl: string;
}
export interface SequenceBand {
  detector: string; status: 'ready' | 'failed'; frameIds: string[];
  stretch?: { low: number; high: number; function: string };
  error?: { code: string; message: string };
}
export interface Sequence {
  requestedDetectors?: string[]; bands?: SequenceBand[];
  id: string; sessionId: string; observationIds: string[]; frameIds: string[];
  status: 'queued' | 'running' | 'ready' | 'failed' | 'cancelled'; jobId: string;
  input?: SearchInput; frames?: RenderFrame[]; warnings?: string[];
  grid?: { width: number; height: number; raDeg: number; decDeg: number; pixelScaleDeg: number };
  pipelineVersion?: string;
  stretch?: { low: number; high: number; function: string };
  error?: { code: string; message: string };
}
export interface Job {
  id: string; sequenceId: string; status: Sequence['status']; progress: number;
  error?: { code: string; message: string }; createdAt: string;
}
export interface AnnotationInput { sequenceId: string; raDeg: number; decDeg: number; text: string; }
export interface Annotation extends AnnotationInput { id: string; createdAt: string; }
export interface Message {
  id: string; role: 'user' | 'assistant'; content: string;
  status?: string; createdAt: string;
}
export interface RunEvent {
  schemaVersion: 1; runId: string; seq: number; timestamp: string;
  type: string; payload: Record<string, unknown>;
}
export interface ShareSnapshot {
  sequence: Sequence; view: ViewState; annotations: Annotation[]; createdAt: string;
}

/** Temporal playback is confined to one verified spectral group. */
export function framesShareBand(sequence: Sequence, frameIds: string[]) {
  return !sequence.bands || sequence.bands.some(band => band.status === 'ready' && frameIds.every(id => band.frameIds.includes(id)));
}

export interface VideoRenderOptions {
  color: boolean;
  exposure: number;
  epochHours: number;
  channels: import('./composite.js').RgbChannel[];
}
