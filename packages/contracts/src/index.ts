import { z } from 'zod';

const identifier = z.string().min(1).max(200);
const utcDate = z.iso.datetime({ offset: true });
export const searchInputSchema = z.object({
  raDeg: z.number().min(0).lt(360),
  decDeg: z.number().min(-90).max(90),
  fovDeg: z.number().positive().max(2),
  fromUtc: utcDate.nullable(),
  toUtc: utcDate.nullable(),
  release: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
}).strict().refine(
  (value) => !value.fromUtc || !value.toUtc || Date.parse(value.fromUtc) <= Date.parse(value.toUtc),
  { message: 'Data początkowa musi poprzedzać końcową.', path: ['toUtc'] },
);
export type SearchInput = z.infer<typeof searchInputSchema>;

export const pointSchema = z.object({
  raDeg: z.number().min(0).lt(360), decDeg: z.number().min(-90).max(90),
}).strict();
export const viewStateSchema = z.object({
  targetId: identifier.nullable(),
  searchInput: searchInputSchema.nullable(),
  searchId: identifier.nullable(),
  searchRequestId: identifier.nullable(),
  selectedObservationIds: z.array(identifier).max(500),
  jobId: identifier.nullable(),
  sequenceId: identifier.nullable(),
  frameIds: z.array(identifier).max(500),
  mode: z.enum(['single', 'blink', 'side_by_side']),
  playing: z.boolean(),
  qualityMask: z.boolean().default(false),
  fps: z.number().min(0.25).max(4),
  zoom: z.number().min(1).max(8),
  panX: z.number().min(-2).max(2),
  panY: z.number().min(-2).max(2),
  selectedPoint: pointSchema.nullable(),
  viewRevision: z.number().int().nonnegative(),
  lastChangedBy: z.enum(['user', 'agent', 'system']),
}).strict();
export type ViewState = z.infer<typeof viewStateSchema>;
export const viewPatchSchema = viewStateSchema.omit({ viewRevision: true, lastChangedBy: true }).partial().strict();
export type ViewPatch = z.infer<typeof viewPatchSchema>;

// Szkielet REST udostępnia edycję filtrów i odtwarzacza. Referencje do danych
// są ustawiane wyłącznie przez serwisy posiadające kontrolę własności zasobów.
export const manualViewRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  patch: viewPatchSchema.pick({ searchInput: true, fps: true, mode: true, playing: true, selectedPoint: true, targetId: true, selectedObservationIds: true, frameIds: true, zoom: true, panX: true, panY: true, qualityMask: true }),
}).strict();

export class DomainError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export * from './resources.js';
export * from './sky.js';

export function initialView(): ViewState {
  return {
    targetId: null, searchInput: null, searchId: null, searchRequestId: null, selectedObservationIds: [],
    jobId: null, sequenceId: null, frameIds: [], mode: 'single', playing: false, qualityMask: false,
    fps: 2, zoom: 1, panX: 0, panY: 0, selectedPoint: null, viewRevision: 0, lastChangedBy: 'system',
  };
}

export function applyViewPatch(current: ViewState, patch: ViewPatch, expectedRevision: number, source: ViewState['lastChangedBy']): ViewState {
  if (current.viewRevision !== expectedRevision) throw new DomainError('VIEW_CONFLICT', 'Ustawienia zmieniły się. Pobierz aktualny stan.');
  const validated = viewPatchSchema.parse(patch);
  const next = viewStateSchema.parse({ ...current, ...validated, viewRevision: current.viewRevision + 1, lastChangedBy: source });
  if (next.playing && (!next.sequenceId || next.frameIds.length < 2)) {
    throw new DomainError('SEQUENCE_REQUIRED', 'Odtwarzanie wymaga przygotowanej sekwencji z co najmniej dwiema klatkami.');
  }
  return next;
}

export const healthSchema = z.object({
  status: z.literal('ok'), database: z.literal('connected'),
  dataMode: z.enum(['demo', 'live']), stage: z.enum(['scaffold', 'mvp']),
});
export { selectCompositeFrames, compositeChannel } from './composite.js';
export { rgbValues, type RgbChannel } from './composite.js';
export { parseExplorerLink, explorerLink } from './links.js';
export { skyDirection, earthIntersection, EARTH_RADIUS_KM, type Vector3 } from './navigation.js';
export { gaiaSourceSchema, gaiaResultSchema, gaiaPosition, type GaiaSource, type GaiaResult, type WiseReference } from './catalogs.js';
