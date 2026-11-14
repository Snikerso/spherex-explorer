# SPHEREx Explorer

Developed by a solo participant.

**[Open the application](https://spherex-explorer-l9m4r.ondigitalocean.app/)**

A web workspace for the NASA Space Apps 2026 challenge [Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/).

Explore real SPHEREx archive observations through coordinate search, time playback, synchronized A/B comparison, false-color RGB, and a text copilot sharing the manual controls. Source times and wavelengths help explain what is being compared. Additional tools provide exploratory stacks, point samples, epoch addition/subtraction, and orbital context.

## Try a local investigation

Select English in the header if needed. Choose an example target or enter RA/Dec in degrees and a field of view. Select an archive release and search. Inspect the returned observations, select a detector and observations, and prepare a sequence. Preparation can take several minutes. Play the sequence or select A/B. Check the time and wavelength of each frame. A target-field search is not confirmation of target detection.

Optionally ask the copilot to search or change playback, then adjust the same controls manually. The copilot requires a configured backend OpenAI key. Use RGB for a false-color view and inspect its source list. Notes stay in the current session. Coordinate links do not share private images or chat.

## Run from source

Requirements: Node 22.12+ from the 22 series or Node 24, pnpm 11.25.0, Python 3.11–3.13, uv, and MongoDB configured as a replica set. Docker is optional for the supplied local MongoDB.

From the repository root:

```bash
pnpm install --frozen-lockfile
uv sync --project workers/imaging --locked
cp .env.example .env
pnpm db:up
```

Copy `.env.example` only on first setup; preserve any existing `.env`. Set `MONGODB_URI` for the local replica set or Atlas and `APP_ORIGIN=http://127.0.0.1:5173`. For the optional copilot, configure `OPENAI_API_KEY` on the backend and `OPENAI_MODEL` with an available compatible model. Keep credentials out of the repository and recordings.

```bash
pnpm db:init
pnpm dev
```

Open http://127.0.0.1:5173. API readiness: http://127.0.0.1:3000/api/v1/health/ready. Manual archive search and image processing do not require an OpenAI key. Use one API process for the local image queue.

## Verification commands

```bash
pnpm check
pnpm test:integration
pnpm test:imaging
```

Integration tests use a temporary MongoDB replica set. These commands do not demonstrate current external archive/model availability. `pnpm demo:scenario` uses synthetic observations and is a tool-flow test, not a NASA-data demo. `pnpm eval:live` calls a paid model with synthetic observation data. With the API running, `pnpm verify:live -- --images` checks the real archive and image preparation.

No fresh execution of these checks is claimed by this documentation update. Historical local integration results are recorded in `docs/12-integracja-live.md` and `output/live-verification.json`.

## Scientific limits and credits

Image playback may mix wavelengths and coverage. RGB is false color; stacks can combine dates and wavelengths. Point samples are surface brightness, not calibrated source photometry. Difference images have no PSF matching or calibrated detection significance. The tool does not establish Planet X discoveries or confirmed source motion. Orbital context is a model; selected sky direction is not live attitude telemetry.

NASA SPHEREx data are served by [NASA/IPAC IRSA](https://irsa.ipac.caltech.edu/Missions/spherex.html). Full data, software references, SI disclosure, and outstanding release-specific credits are listed in [submission text](01-project-submission-en.md). OpenAI language models power the optional application copilot; OpenAI Codex assisted with submission documentation. The author must finish the development and media SI inventory there before publishing the final package.

The README and project documentation are available in English. Existing filenames are retained for stable links. Historical design prompts preserve their original wording; the concept mockup is an AI-generated design reference, not observational evidence.
