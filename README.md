# SPHEREx Explorer

Explore NASA's infrared sky observations across time and wavelength.

I developed SPHEREx Explorer as a solo participant for [NASA Space Apps 2026: Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/). The application brings archive search, image preparation, visual comparison, and a natural-language copilot into one workspace.

**[Open the application](https://spherex-explorer-l9m4r.ondigitalocean.app/)** · **[Project guide](docs/submission/03-project-guide-en.md)** · **[Submission checklist](docs/submission/00-checklista-pl.md)**

## Features

- Search real SPHEREx Level 2 observations from NASA/IPAC IRSA by RA/Dec, field of view, release, and dates; start with five challenge example targets.
- Prepare FITS cutouts on a common TAN sky grid and inspect blink playback or synchronized A/B views.
- Explore detector/time availability, false-color RGB, exposure adjustment, and monochrome/RGB MP4 exports.
- Inspect point samples across wavelengths, detector stacks, stack RGB compositions, and epoch addition/subtraction.
- Use a text copilot through the OpenAI Agents SDK; its operations share the manual controls and revisioned session state.
- Inspect observation sources, dates, wavelengths, quality flags, and selected sky coordinates; save session notes.
- Explore orbital context in a 3D navigation view, including separately labelled archival detector pointing.
- Switch between English and Polish without resetting the workspace.
- Use Gaia DR3 overlays, AllWISE reference comparisons, and CADC/NEOSSat coverage queries in the current source tree.

Features in the working tree may be newer than the public deployment. The [integration report](docs/12-integracja-live.md) describes processing behavior and historical verification; [deployment notes](deploy/README.md) record the deployment baseline.

## Scientific scope

This is an exploratory tool. A search around a target does not establish that the target is detected. Playback may combine wavelengths and coverage, so apparent changes can reflect spectral differences or processing artifacts. RGB colors are assigned for visualization. Point samples are surface brightness, not aperture/PSF photometry. Stacks can mix dates and wavelengths; difference images have no PSF matching or calibrated detection significance. The application does not establish a Planet X discovery or automatically confirm moving sources.

Coordinate links reopen a search context; they do not publish private images or chat. Public session snapshots and a distributed job queue are not implemented. The local preparation queue requires **one API process**. Interrupted unfinished jobs fail explicitly after restart.

## Run locally

Requirements: Node 22.12+ from the 22 series or Node 24, pnpm 11.25.0, Python 3.11–3.13, uv, and MongoDB running as a replica set (Atlas or local).

```bash
pnpm install --frozen-lockfile
uv sync --project workers/imaging --locked
cp .env.example .env # first setup only; preserve an existing .env
pnpm db:up          # optional local MongoDB; requires Docker
```

Set `MONGODB_URI` and `APP_ORIGIN=http://127.0.0.1:5173` in `.env`. For the optional copilot, set backend-only `OPENAI_API_KEY`, `OPENAI_MODEL`, and optionally `OPENAI_REASONING_EFFORT`. The repository's configured model is `gpt-6.1-sol`; use a compatible model available to your account.

```bash
pnpm db:init
pnpm dev
```

Open [the local frontend](http://127.0.0.1:5173). Check [API/database readiness](http://127.0.0.1:3000/api/v1/health/ready). Manual search and images work without an OpenAI key; chat reports missing configuration.

For the maintainer's existing Doppler environment:

```bash
doppler run --project sphere_x --config dev -- pnpm db:init
doppler run --project sphere_x --config dev -- pnpm dev
```

A first investigation: select WISE 0855 → DR1 → Search → choose observations → prepare a sequence → Blink → Play. FITS downloads may take minutes. Inspect frame dates and wavelengths before interpreting differences. The current pipeline retains usable observations across wavelengths rather than restricting playback to a matched spectral subset.

## Checks

```bash
pnpm check             # lint, types, offline tests, build
pnpm test:integration  # temporary MongoDB replica set; no Atlas/IRSA/OpenAI
pnpm test:imaging      # Python worker tests
pnpm format:check     # frontend and observation-module formatting
pnpm demo:scenario    # scripted tool workflow using synthetic data
pnpm eval:live        # paid model evaluation with synthetic observations
pnpm verify:live -- --images # real archive check; requires the API running
```

The scripted scenario does not test language understanding. Model evaluation does not verify IRSA. Historical results are dated in the documentation; translating it does not imply a fresh test run.

## Documentation

The documentation is in English. Existing filenames are retained to preserve repository links.

| Document | Contents |
| --- | --- |
| [01 — Scope and requirements](docs/01-zakres.md) | Audience, challenge, acceptance criteria, future work |
| [02 — Architecture and data](docs/02-architektura-i-dane.md) | Components, archive access, imaging, jobs and cache |
| [03 — Text copilot](docs/03-agent.md) | Tools, shared controls, history, streaming and limits |
| [04 — API and data model](docs/04-api-i-model-danych.md) | Routes, ownership, SSE, collections and conflicts |
| [05 — Backlog](docs/05-backlog.md) | Original delivery milestones and outstanding acceptance work |
| [06 — Verification and deployment](docs/06-testy-i-wdrozenie.md) | Test strategy, configuration, release criteria |
| [07 — Sources and decisions](docs/07-zrodla-i-decyzje.md) | References, choices, risks and attribution |
| [08 — Interface](docs/08-interfejs-kokpit.md) | Cockpit layout, interaction and accessibility |
| [09 — Agent scenarios](docs/09-scenariusze-i-testy-agenta.md) | Offline tests, model evaluation and historical results |
| [10 — Demonstration plan](docs/10-plan-demonstracji.md) | Submission demo and optional extended walkthrough |
| [11 — Setup and Atlas](docs/11-uruchomienie-i-atlas.md) | Environment, MongoDB, startup and REST example |
| [12 — Integration report](docs/12-integracja-live.md) | Implementation changes, evidence and scientific limits |
| [Deployment](deploy/README.md) | Hosting baseline and release configuration |

## Code organization

```text
apps/web/src/
  App.tsx                 # layout and feature integration
  app/components/         # header, tabs, operation status, footer
  features/
    explorer/             # session, API synchronization, agent events
    navigation/           # search, orbital model, 3D scene, FITS pointing
    sky/                  # viewport, band grid, playback, RGB and exports
    instruments/          # metadata, quality and notes
    analysis/             # point samples, stacks, epoch comparison
    catalogs/             # Gaia, WISE and CADC reference tools
    copilot/              # conversation and message display
  shared/                 # API client, i18n and formatting
  styles/                 # base, layout and cockpit theme
apps/api/src/modules/     # domain services, ownership and integrations
packages/contracts/       # shared Zod schemas and TypeScript types
workers/imaging/          # Python FITS processing and tests
config/                   # archive release catalogue
```

Sky state lives in hooks above the tab content, preserving playback/RGB settings when switching tabs. Orbital calculations and GPU-resource management are separate from React. Frontend tests live beside their modules. The API imaging directory contains cutout download, cache paths, and worker invocation; `ObservationsService` owns session checks, job orchestration, and result persistence. Keep base → layout → theme → instrument style ordering.

## Cache and persistence

Cleanup runs at startup and hourly (`CLEANUP_INTERVAL_MS`, minimum one minute). Sessions expire after seven inactive days, with an additional 24-hour cleanup buffer. Active jobs/runs defer session deletion. Session records are removed last so partial cleanup can be retried.

Managed local cleanup covers `sequences`, `fits`, `analyses`, and `exports` under `CACHE_ROOT`. It removes orphaned sequences and unreferenced FITS/temporary files older than `CACHE_RETENTION_HOURS` (default/minimum 24). Referenced FITS and retained sequences are preserved. Symlinks are not followed. Missing/corrupt manifests prevent deletion of shared FITS. Cleanup does not overlap downloads, analysis, or exports in the API process. Scheduled cleanup is disabled in tests.

The current source supports private S3-compatible DigitalOcean Spaces for durable FITS, PNG, radiance arrays, and sequence manifests. Configure `SPACES_BUCKET`, `SPACES_REGION`, `SPACES_ACCESS_KEY_ID`, and `SPACES_SECRET_ACCESS_KEY`; default prefix: `spherex/v1/`. With no storage configuration, files remain local. Partial configuration prevents startup.

FITS keys hash the complete cutout URL, including region. Reads check local cache, then object storage, then IRSA. Concurrent same-file requests share a download within one API process. Sequence assets are stored before readiness is committed and restored locally on demand after restart. Access remains through the ownership-checked API; buckets are private. MP4 exports remain temporary. Storage errors are surfaced, not treated as missing files.

Object cleanup preserves FITS referenced by ready sequences; unused FITS retention is controlled by `SPACES_FITS_RETENTION_DAYS` (default 90). Incomplete manifests stop shared-FITS cleanup. Migrate an existing cache with the repeatable command:

```bash
doppler run --project sphere_x --config dev -- pnpm --filter @spherex/api storage:migrate
```

Existing objects are skipped. Configuring storage does not itself release code to the public application. See deployment notes for environment mapping.

## Reference data

**Gaia DR3:** up to 300 bright sources from ESA TAP, with a search margin for proper motion and maximum radius 0.5°. Markers use the sequence TAN grid and tangential propagation to frame time. Missing motion components retain catalogue positions; observer parallax and radial velocity are not included. A marker selects a point and pauses playback. The copilot's `lookup_gaia` uses a 72″ radius at catalogue epoch. Catalogue proximity is not confirmed identification.

**AllWISE W1/W2:** IRSA SIA2 selects scientific intensity tiles (`science`, `*-int-3.fits`); the nearest tile center is preferred. IBE cutouts are reprojected to the sequence grid with independent asinh contrast. Gzip is detected regardless of URL suffix, with a 32 MiB decompressed limit. Tile edges can limit coverage. Dates come from FITS or SIA2 `t_min`/`t_max`; unknown periods are labelled. No cross-mission subtraction or photometry is claimed.

**CADC/NEOSSat:** public ObsCore/TAP coverage metadata, maximum radius 0.5°, default ±7 days around the frame, or all dates. Up to 100 recent products include dates and DataLink references. Empty results mean no matching coverage; they do not establish absence of an object. No automatic cross-mission identification or NEOSSat reduction is performed.

Catalogue results are not stored in MongoDB. Gaia cache is bounded to 32 queries for ten minutes; WISE temporary cutouts are removed after rendering. Reference rendering is serialized per API process and checks sequence ownership.

## Data credits, AI use and authorship

NASA SPHEREx observations are provided through [NASA/IPAC IRSA](https://irsa.ipac.caltech.edu/Missions/spherex.html). Additional references include [Gaia DR3](https://gea.esac.esa.int/archive/documentation/GDR3/), [AllWISE](https://irsa.ipac.caltech.edu/ibe/docs/wise/allwise/p3am_cdd/), [CADC TAP](https://www4.cadc.hia.nrc.gc.ca/en/doc/tap/), [CelesTrak](https://celestrak.org/), and [Natural Earth](https://www.naturalearthdata.com/). See [sources and attribution](docs/07-zrodla-i-decyzje.md) for release-specific credit requirements.

The project was developed by a solo participant. OpenAI models power the optional copilot; OpenAI Codex assisted with development, debugging, and documentation. Astronomical observations are archive data, not generated images. The original UI concept mockup was AI-generated and is labelled as a design reference. The submission package tracks remaining media disclosures and credits. This is an independent challenge entry; it does not imply NASA endorsement.

No project code license has been selected in this repository. Third-party data and dependencies retain their respective terms.
