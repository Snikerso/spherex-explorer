# Verification, configuration and deployment

## Test strategy

| Area | Cases | Acceptance |
| --- | --- | --- |
| Coordinates | RA wrap, Dec poles, negative zero, sexagesimal input | Correct units/bounds; invalid input rejected |
| Archive | Empty results, timeouts, schema changes, reprocessed products | Explicit errors; no fake data/duplicate epochs |
| Time and wavelengths | Time scales, ordering, coverage and releases | Preserve original metadata; explain mixed-wavelength comparisons |
| Geometry | FITS/output control points and pixel/sky round trip | Original target ≤0.5 pixel, confirmed for the chosen pipeline |
| Rendering | Masks, missing WCS, common contrast and empty coverage | No zero-filled missing data or geometry-induced fake motion |
| Jobs | Cancel/restart/retry/limits | Terminal state, no duplicate or partial previews |
| Ownership | Other-session run/job/image/note IDs | No access despite knowing UUIDs |
| MongoDB | Unique indexes, concurrent writes, transactions and cleanup | One active run/job per session; no partial history commits |
| SSE | Reconnect, `Last-Event-ID`, duplicate request | No duplicate run/message |
| UI | Search → playback → A/B → note; mobile and keyboard | Usable controls, readable metadata and explicit limits |
| Copilot | Tool choice, arguments, context and errors | Claims only successful operations |
| Shared controls | Agent change → manual override → refresh → follow-up | Committed values restored and manual changes respected |
| Concurrent editing | Draft input plus late events/results | No lost draft or overwrite of newer state |

Vitest covers contracts, tools and HTTP/database integration; pytest covers imaging. Browser E2E is a separate acceptance layer. Synthetic geometry tests do not establish scientific results on real observations. Offline CI does not need paid model calls or a live IRSA service. Database integration uses an actual temporary replica set.

## Commands and evidence

```bash
pnpm check
pnpm test:integration
pnpm test:imaging
pnpm format:check
pnpm demo:scenario
```

Explicit external checks:

```bash
pnpm eval:live
pnpm eval:live --repeat 3
pnpm verify:live -- --images
```

Model evaluation is paid and uses synthetic observation data. Archive verification requires a running API and tests real data access. Neither replaces the other. Record date, commit, environment and result when reporting verification. See [agent scenarios](09-scenariusze-i-testy-agenta.md) and [integration results](12-integracja-live.md).

For every challenge target, retain coordinate source/epoch, field size, release, observation dates, wavelength coverage, comparison outcome and limitations. Proper-motion targets are not fixed at catalogue coordinates forever. Two images alone do not confirm a new planet.

## Model evaluation acceptance goals

Cover example search, explicit coordinates, unknown target, no data, IRSA failure, preparation, speed/A-B changes, selected-point notes, cancellation, false discovery confirmation and other-session access. The original plan calls for at least three trials per case, all critical ownership/no-fabrication cases passing, and ≥90% correct tool selection for ordinary commands. Record model, prompt version, parameters, outputs, usage and cost. A small evaluation set is not evidence of production reliability.

## Environment

Use [.env.example](../.env.example) and backend configuration as the supported variable list. Never expose OpenAI/storage/database secrets through `VITE_*` variables.

| Setting | Purpose |
| --- | --- |
| `MONGODB_URI` | Database URI, database name and replica set |
| `APP_ORIGIN` | Allowed frontend origin |
| `API_PORT` | Backend listener; coordinate with Vite proxy |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT` | Optional server-side copilot configuration |
| `CACHE_ROOT`, `IMAGING_PYTHON` | Managed cache and optional worker interpreter |
| `DATA_MODE` | Configured observation-data mode; do not present synthetic fixtures as live archive data |
| `AGENT_TIMEOUT_MS`, `AGENT_MAX_TURNS` | Model run duration and step bounds |
| `SPHEREX_RELEASES_FILE` | Optional replacement release catalogue |
| `CLEANUP_INTERVAL_MS`, `CACHE_RETENTION_HOURS` | Maintenance schedule and local retention |
| `SPACES_BUCKET`, `SPACES_REGION`, `SPACES_ACCESS_KEY_ID`, `SPACES_SECRET_ACCESS_KEY`, `SPACES_PREFIX` | Optional private object storage |
| `SPACES_FITS_RETENTION_DAYS` | Unreferenced stored-FITS retention |

Earlier planning names such as `CACHE_DIR`, `IRSA_COLLECTION`, `DAILY_SESSION_TOKEN_LIMIT` and `OPENAI_DAILY_BUDGET_USD` are not a promise of implemented configuration. Check code before setting them. A global budget mechanism requires its own validation.

## Deployment and fallback

See [setup](11-uruchomienie-i-atlas.md) and [deployment notes](../deploy/README.md). The application uses a static frontend, NestJS with Python processing, Atlas, one API process and a same-origin reverse proxy. Forward SSE without buffering or premature idle timeout. Local container storage is ephemeral; durable assets require configured private object storage.

Before release, check build/tests, indexes/migrations, HTTPS/cookies/origins, archive allowlists, size/time limits, usage limits, session/cache cleanup, recovery and secret-free logs. Do not fetch arbitrary user/model URLs. Provisioning infrastructure or setting Doppler secrets does not deploy code.

If IRSA is unavailable, present previously retrieved real images with source manifest and explicit cache/fallback status. If OpenAI is unavailable, manual search/playback still work. A recording or mockup must be identified as such.

## Demonstration and original completion criteria

The submission demo is **at most 30 seconds or seven slides**; the [English production script](submission/02-demo-en.md) replaces the old three-minute submission plan. An extended technical walkthrough is optional additional material.

The original full MVP requires evidence for all P0 tasks, a public real-data workflow, a five-target report, editable shared controls after refresh, reproducible setup/tests/manifests/credits, and a public snapshot without chat. The last requirement remains unimplemented; coordinate links are more limited. Do not mark the entire MVP complete simply because the core viewer works.
