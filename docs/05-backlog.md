# Delivery backlog

P0 denotes original MVP acceptance work; P1/P2 denote extensions. FE = frontend, BE = backend, DATA = imaging/data, QA = verification. This is the original milestone register, translated and condensed. Unchecked work may have partial or complete implementation; it is not automatically accepted without evidence for all criteria. Refer to the [integration report](12-integracja-live.md) for current features.

## Stage 1 — data and decisions

- [ ] **D01 · P0 · DATA/BE:** Query real SIA2 data; record schema/mapping, formats, times, versions, URLs and empty-result behavior.
- [ ] **D02 · P0 · DATA:** Find two suitable demo observations and examine all five challenge targets; record dates, coverage, limitations and selection rationale, including no-data outcomes. Depends on D01.
- [ ] **D03 · P0 · DATA:** Read correct FITS HDUs, masks and WCS; align/render two cutouts and validate control points and spectral policy. Depends on D02.
- [ ] **D04 · P0 · author:** Record name, UI languages, API budget, hosting and scientific tolerances; confirm model availability with an explicit test.

Gate: real images and defensible comparison conditions exist before expanding chat.

## Stage 2 — foundation

- [x] **S01 · P0 · FE/BE:** pnpm monorepo, React/Vite, NestJS, strict TypeScript, lint and build.
- [ ] **S02 · P0 · BE:** Atlas/Mongoose schemas, indexes and repeatable initialization/data migration. Depends on S01.
- [ ] **S03 · P0 · FE/BE:** Shared validated contracts, errors and OpenAPI. Depends on S01; OpenAPI remains an outstanding part of this criterion.
- [ ] **S04 · P0 · BE:** Anonymous sessions; another session cannot read runs, jobs, assets or notes. Depends on S02.
- [ ] **S05 · P0 · BE:** Health checks, request IDs, safe logs and CI checks on pull requests. Depends on S01.

## Stage 3 — search and imaging

- [ ] **B01 · P0 · BE:** IRSA adapter with validation, timeout/retry and distinct empty/error states. Depends on D01/S03.
- [ ] **B02 · P0 · BE:** Example catalogue with sources/epochs and coordinate-boundary tests. Depends on D02.
- [ ] **B03 · P0 · DATA/BE:** Reproducible frame pipeline, cache, provenance, masks, grid and spectral policy. Depends on D03/B01.
- [ ] **B04 · P0 · BE:** Persist jobs, progress, cancellation and restart recovery without duplicates or stale results. The original lease/heartbeat distributed-worker design is not implemented by the current local queue. Depends on B03/S02.
- [ ] **B05 · P0 · BE:** Authorized previews, approved archive URLs and size limits. Depends on B03/S04.

## Stage 4 — viewing interface

- [ ] **F01 · P0 · FE:** Accessible responsive cockpit, real controls, empty/loading/error states. Depends on S01.
- [ ] **F02 · P0 · FE:** Coordinate/FOV/date/example form with API validation. Depends on B01/B02.
- [ ] **F03 · P0 · FE:** Image viewer, zoom/pan, timeline, dates and speed; no playback of unready sequences. Depends on B04/B05.
- [ ] **F04 · P0 · FE:** Blink/A-B with shared geometry and explicit comparison limitations. Depends on F03.
- [ ] **F05 · P0 · FE:** Release/date/quality/source metadata. Depends on F03.
- [ ] **F06 · P0 · FE/BE:** Click-to-ICRS, notes and explicit sharing. Original acceptance requires a public snapshot without chat; coordinate links alone do not meet it. Depends on F03/S04.
- [ ] **F07 · P0 · FE/BE:** Shared controls, refresh restoration, manual overrides and protection of drafts/newer edits from stale events. Depends on F02–F04/S03/S04.

## Stage 5 — copilot

- [ ] **A01 · P0 · BE:** SDK agent, instructions, available model and bounded runs. Depends on S01/D04.
- [ ] **A02 · P0 · BE:** Resolve/search/prepare tools using real domain results and validated errors. Depends on A01/B01–B04.
- [ ] **A03 · P0 · FE/BE:** View/playback/selection/note tools, visible updates and conflict handling. Depends on F03/F06/F07/A01.
- [ ] **A04 · P0 · BE:** SDK history, SSE, replay, cancellation, idempotency and ownership. Depends on S04/A01.
- [ ] **A05 · P0 · FE:** Chat, streaming, tool status and Stop; follow-up commands update the same manual controls. Depends on A02–A04.
- [ ] **A06 · P0 · QA/BE:** Model evaluations, usage/cost measurements and no fabricated success claims. Depends on A05.

## Stage 6 — acceptance and submission

- [ ] **Q01 · P0 · QA:** Data/WCS/contracts/ownership, indexes, transactions, concurrency and cleanup on a test replica set. Depends on B05/A04.
- [ ] **Q02 · P0 · QA:** Browser E2E: form → images → chat → note → share, replay/errors, manual overrides, refresh, concurrent edits and keyboard use. Depends on F06/F07/A05.
- [ ] **Q03 · P0 · QA/DATA:** Five-target report with availability, dates, comparison policy and limitations; no invented detections. Depends on D02/F04.
- [ ] **R01 · P0 · BE:** Containers, Atlas, initialization/migrations, HTTPS and persistence across restart. Depends on Q01/Q02.
- [ ] **R02 · P0 · author:** Hosted compliant demo, fallback data, NASA-use description, sources and limitations. Depends on Q03/R01.
- [ ] **R03 · P0 · author:** Reproducible README, configuration, authorship and code-license decision. Depends on R01. English documentation is now supplied; the code-license decision remains open.

## Extensions

- [ ] **X01 · P1:** PSF/background/unit-aware difference imaging and artifact tests. Exploratory subtraction is not full completion.
- [ ] **X02 · P1:** Displacement with uncertainty, without automatic confirmation.
- [ ] **X03 · P1:** Gaia/WISE reference tools with epoch/proper-motion context. Initial implementations exist; full acceptance still needs evidence.
- [ ] **X04 · P1:** External name resolution, CSV/JSON, mosaics and larger fields. Some exports/field sizes exist; mosaics remain separate.
- [ ] **X05 · P2:** Calibrated photometry, light curves and spectra with uncertainty propagation.
- [ ] **X06 · P2:** Candidate suggestions, accounts, collaboration and a scalable queue.

For a short hackathon, prioritize data correctness and working shared controls. An exploratory extension does not replace core acceptance evidence.
