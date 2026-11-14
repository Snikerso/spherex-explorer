# API contracts and data model

All routes use `/api/v1`. REST uses JSON; agent events use SSE. `packages/contracts` is the source of types and runtime validation. This document covers implemented behavior and explicitly identified future interfaces; it is not a generated OpenAPI reference.

## Implementation status

Sessions, views, targets, IRSA search, jobs/cancellation, authorized sequence assets, annotations, messages and agent run/SSE/cancellation are implemented. `GET /capabilities` describes agent availability; `GET /agent/runs/current` supports refresh recovery. Manual searches, preparation and annotations require `expectedRevision`.

Public snapshots, session deletion, paginated history and published OpenAPI remain planned. Coordinate links recreate search settings without publishing session assets. Additional export/analysis/reference endpoints are implemented in the current source; see controllers and the [integration report](12-integracja-live.md).

## Session ownership

`POST /sessions` creates an anonymous session with a random cookie secret. Production cookies use `HttpOnly`, `Secure` and `SameSite=Lax`; the database stores a hash. Knowing a resource UUID is not authorization. Every private read/write checks session ownership. Inactivity expiry is seven days.

The deployment serves frontend and `/api` from one origin and validates write origins. A split-domain deployment requires an explicit CORS/CSRF design. Planned public shares would use a separate random token and selected content only, never session credentials or conversation history.

## Main endpoints

| Route | Behavior |
| --- | --- |
| `POST /sessions` | Create session, cookie and `{sessionId, expiresAt}` |
| `GET /sessions/current` | Current session summary |
| `GET /targets` | Supported example targets |
| `GET /data-releases` | Validated configured archive releases |
| `POST /observation-searches` | Region → saved search, results, warnings and `truncated` |
| `GET /observation-searches/:id` | Session-owned search |
| `POST /sequences` | Selected observations → HTTP 202, job and sequence IDs |
| `GET /jobs/:id` | Status, progress, error or result |
| `POST /jobs/:id/cancel` | Idempotent preparation cancellation |
| `GET /sequences/:id` | Frame manifest, processing settings and warnings |
| `GET /sequences/:id/frames/:frameId` | Authorized PNG preview |
| `GET /sequences/:id/frames/:frameId/radiance` | Authorized Float32 preview data |
| `POST /sequences/:id/export` | Monochrome/RGB MP4 export |
| `POST /sequences/:id/analyze` | Source-FITS exploratory analysis |
| `GET /view` | Complete committed workspace state and revision |
| `PATCH /view` | Validated manual patch with `expectedRevision` |
| `POST /annotations` | Save a sky-coordinate note |
| `GET /sequences/:id/annotations` | Session-owned notes |
| `POST /agent/runs` | Message and `clientRequestId` → HTTP 202 and run ID |
| `GET /agent/runs/current` | Recover the current run |
| `GET /agent/runs/:id/events` | Authorized SSE with `Last-Event-ID` replay |
| `POST /agent/runs/:id/cancel` | Cancel a run |
| `GET /messages` | Renderable session conversation |
| `GET /capabilities` | Runtime capability/configuration availability |
| `GET /spacecraft-orbit` | Validated CelesTrak orbital elements with cache/fallback status |
| `GET /health/live`, `GET /health/ready` | Process liveness and local dependency readiness |

Planned routes: `DELETE /sessions/current`, `POST /shares`, `GET /shares/:token`, `GET /shares/:token/frames/:frameId`, and `DELETE /shares/:token`. Do not call them as implemented endpoints. Agent tools call domain services directly, not HTTP requests to the application's own API.

## Conceptual types

These abbreviated shapes explain the model; the actual shared schemas include newer RGB, quality and analysis settings.

```typescript
type SearchInput = {
  raDeg: number;
  decDeg: number;
  fovDeg: number; // square field width, not radius
  fromUtc: string | null;
  toUtc: string | null;
  release: string; // validated against the release catalogue
};

type Observation = {
  id: string;
  sourceId: string;
  release: string;
  observedAtUtc: string;
  originalTime: { value: string; format: string; scale: string };
  detector: string;
  spectralRangeUm: [number, number] | null;
  calibrationVersion: string | null;
  qualityFlags: string[];
  sourceUrl: string;
};

type ViewState = {
  targetId: string | null;
  searchInput: SearchInput | null;
  searchId: string | null;
  searchRequestId: string | null;
  selectedObservationIds: string[];
  jobId: string | null;
  sequenceId: string | null;
  frameIds: string[];
  mode: 'single' | 'blink' | 'side_by_side';
  playing: boolean;
  fps: number;
  selectedPoint: { raDeg: number; decDeg: number } | null;
  viewRevision: number;
  lastChangedBy: 'user' | 'agent' | 'system';
};
```

The view includes search controls, not just the image. Search records retain actual query parameters; sequences retain actual render parameters. Editing a form does not change existing images. A new search invalidates selections from the old result. React restores committed state on startup and updates it from REST or `view.updated`; unfinished local input stays separate.

Annotations use ICRS sky coordinates rather than screen pixels. Click conversion uses the manifest's output-grid WCS. Manifests retain grid size, coverage, processing and source references. Validate pixel/sky round trips using control points.

## SSE contract

Events have an ID, `event` name and JSON `data`, with `schemaVersion`, `runId`, monotonic `seq`, `timestamp` and `payload`.

| Event | Payload |
| --- | --- |
| `run.started` | Message ID and starting revision |
| `message.delta` | Message ID and text fragment |
| `tool.started` | Tool-call ID, name and safe description |
| `tool.completed` | Tool-call ID, status and optional job/sequence IDs |
| `view.updated` | Full committed state and changed fields; origin in `lastChangedBy` |
| `annotation.created` | Saved annotation ID and content |
| `run.completed` | Final message and source references |
| `run.failed` | Error code, safe description and retryability |
| `run.cancelled` | Terminal cancellation state |

Persist events before sending. Replay after reconnect; clients deduplicate by ID. A terminal event closes the stream, and final text replaces the draft rather than duplicating it. The original heartbeat target is an SSE comment every 15 seconds. Image preparation progress is read from job status independently.

## MongoDB collections

Mongoose schemas use explicit collections, timestamps and versioning where defined. IDs are string UUIDs, mapped to `id` in API responses. References do not bypass ownership checks. Operational dates use BSON Date; astronomical time representations remain in source metadata.

| Collection | Main information |
| --- | --- |
| `sessions` | Token hash, creation/activity/expiry/revocation |
| `targets` | Name, coordinates, frame, epoch and source |
| `observationSearches` | Session, parameters, bounded results and creation time |
| `observations` | Source ID, release, calibration, time and source URL |
| `sequences` / `sequenceFrames` | Ownership, search, status, configuration, pipeline, ordering and WCS |
| `jobs` | Session, sequence, status, active flag, progress and errors |
| `views` | Workspace state and revision |
| `agentRuns` | Session, client request ID, state, model, usage and timestamps |
| `agentHistories` / `agentHistoryItems` | Versioned SDK history and ordered complete items |
| `messages` | Renderable conversation, roles and sources |
| `runEvents` | Run, sequence number, event type and payload |
| `annotations` | Session, sequence, sky position, note and idempotency key |
| `shares` (planned) | Token hash, owner, immutable snapshot and revocation |

Original design indexes include token uniqueness; product identity by source/release/calibration; run idempotency by session/client request; ordered run events and history items; sequence frame ordering; one view/history per session; and annotation idempotency. Partial unique indexes enforce one active run and preparation per session. Terminal states release `active`. Initialization scripts, rather than production Mongoose auto-indexing, create the required indexes. Check current schemas/scripts for actual collection coverage.

Do not embed unbounded histories, events or images in a session document. MongoDB's BSON document limit is 16 MiB; application tool/history payloads should stay below it. FITS and previews stay outside MongoDB. Session cleanup blocks access, removes private dependents explicitly, and deletes the session last; MongoDB does not cascade references.

## Errors and concurrency

Error shape: `{error: {code, message, retryable, requestId}}`.

| Status / code | Meaning |
| --- | --- |
| `400 INVALID_COORDINATES` / `INVALID_FILTER` | Invalid input |
| `401 SESSION_REQUIRED` | Missing valid session |
| `404 RESOURCE_NOT_FOUND` | Missing resource, including another session's resource |
| `409 RUN_IN_PROGRESS` / `VIEW_CONFLICT` | Concurrent operation or stale revision |
| `422 NO_COMPARABLE_FRAMES` | Insufficient usable comparison frames |
| `429 RATE_LIMITED` | Usage limit |
| `502 DATA_SOURCE_ERROR` / `504 DATA_SOURCE_TIMEOUT` | External provider failure |

An empty successful search returns `200` and an empty list. Repeating a run request with the same `clientRequestId` returns the existing run. View updates match session and `expectedRevision`, incrementing revision atomically; a failed match is a conflict. Multi-document history commits use short transactions; model calls, downloads and image processing remain outside transactions. A replica set is required. Restart recovery closes orphaned active runs/jobs.

References: [MongoDB atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/), [document limits](https://www.mongodb.com/docs/manual/reference/limits/).
