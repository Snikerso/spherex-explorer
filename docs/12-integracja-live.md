# Integration report — 14 November 2026

This report records implementation changes and historical local observations. Later sections supersede earlier pipeline/UI behavior. These are not fresh verification results produced by the English documentation update. Public deployment can lag the current source tree.

The local flow includes NestJS/MongoDB, IRSA SIA2 search, FITS cutouts, a common TAN WCS grid, blink/A-B, notes and the OpenAI Agents SDK. Copilot and manual controls write the same revisioned state. SSE replays events after `Last-Event-ID`; SDK history and messages remain session-scoped in MongoDB.

## Verified archive searches

Field width 0.1°, no date filter, DR1:

| Target field | Products |
| --- | ---: |
| Barnard’s Star | 259 |
| Epsilon Indi B | 417 |
| RW Aurigae | 237 |
| R Draconis | 459 |
| WISE 0855 | 297 |

These are field-search counts, not confirmation that the named objects are detected. WISE 0855 in QR3 returned no results.

A checked WISE 0855-field / D1 pair used 6 May 2025 12:20 UTC and 31 October 2025 18:55 UTC, with center wavelengths 0.9937 and 0.9913 µm. These are visual previews without PSF matching or source photometry. No visibility/detection of WISE 0855 itself is claimed.

## Historical quality policy v3

The previous `FLAGS == 0` filter incorrectly removed SOURCE (bit 21), which identifies astronomical source signal. Policy v3 preserves unflagged pixels and SOURCE-only pixels; SOURCE combined with a defect remains masked. See [IRSA flags](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html) and the [IRSA source-discovery example](https://caltech-ipac.github.io/irsa-tutorials/spherex-source-discovery-tool-demo/).

The historical quality toggle selected masked/unmasked variants produced together on the same grid and contrast, without downloading FITS again. Masked pixels included other flags or invalid variance. The checked pair's common coverage changed from an incorrect 27.5% to 67.6% after preserving SOURCE; the unmasked diagnostic variant had 84.7%. Old manifests without both assets needed reprocessing.

The toggle was subsequently removed at the author's request. The UI uses `quality=off` and synchronizes existing sessions to `qualityMask=false`; both API asset variants remain for compatibility. Later v5 changes below also remove the older spectral/pairwise coverage restrictions. Numerical analysis continues to apply its own documented quality rules.

## Commands and test coverage

```bash
uv sync --project workers/imaging --locked
pnpm db:up
pnpm dev:doppler
pnpm check
pnpm test:integration
pnpm test:imaging
pnpm verify:live -- --images # requires a running API; accesses the real archive
```

The recorded model configuration is `gpt-6.1-sol`, reasoning effort `low`; the key stays on the backend. Deterministic `select_observations` chooses detector observations without making the model reproduce long ID arrays.

Offline tests cover coordinates, revision conflicts, SOURCE preservation/defect masking, shared contrast, PNG orientation and asset variants. HTTP tests cover ownership, invalid inputs, cancellation, SSE replay and idempotency. The preparation queue requires one API process. Coordinate links do not publish private images/chat. English/Polish UI, cleanup and a public HTTPS deployment were added after the initial integration baseline; deployment notes and current source describe their availability.

## Detector selection, playback and all-observation export

The detector selector uses D1–D6 and wavelength-range labels from search metadata. Changing it filters the list without downloading files. Earlier versions selected at most 24 observations and retained a spectrally matched subset; those restrictions were later removed. Current searches return at most 500 products, and preparation can include the whole selected result. The panel shows prepared/requested counts and download/coverage warnings.

The player combines previous/play-pause/next, frame slider, counter and speed. Dates remain visible; the slider explains irregular observation spacing. A detector represents a wavelength range, not an exact fixed wavelength. Until replacement preparation finishes, the prior image retains its real metadata.

`POST /sequences/:id/export` checks ownership and frame membership. Monochrome export uses the current band's chronological frames/FPS with UTC/wavelength captions. Encoding uses imageio-ffmpeg's bundled FFmpeg, H.264/yuv420p and faststart. Temporary work files are removed on success or failure. Sync Python dependencies after changing export packages.

## Multiband playback v5

The author requested `tan-all-wavelengths-multiband-v5`, retaining every readable observation covering the field center regardless of wavelength. Largest-compatible-group selection and per-pixel spectral masking were removed. Frames retain individual spatial coverage and share contrast. Dates and wavelengths remain visible and are included in MP4 captions. Warnings explain that differences can reflect wavelength rather than temporal change.

A cached Andromeda sequence was reprocessed from four to 18 frames without retrieving unavailable IRSA products again. This is a processing example, not a scientific detection result.

## RGB and exposure

RGB controls offer epoch windows of 1/6/24/72/168 hours and exposure −6…+2 EV. Composites use only prepared frames on the current grid. Selection favors a nearby group with as many distinct detectors as possible, one observation per detector. The span between earliest/latest sources must fit the selected window, and candidates must also fall within that distance of the current frame time.

Sources show actual UTC dates, wavelengths and channel assignments. Shorter wavelengths are blue, intermediate green, longer red; with two bands the green channel is their geometric mixture. These are assigned colors, not photometry. Missing channel coverage remains transparent. There is no PSF matching.

The worker stores linear contrast-normalized values before white clipping as little-endian Float32 (`radianceName`). The ownership-checked radiance endpoint serves these arrays. The browser applies `2**EV` before asinh, allowing recovery of detail above the PNG white point. Older sequences fall back to previews and request reprocessing for full exposure adjustment.

### RGB MP4

Export accepts `color`, `exposure`, `epochHours` and three `{enabled, detector}` channels. RGB mode labels the button “↓ RGB MP4”. Backend selection uses the same epoch selector as the preview and never accepts client file paths. Epochs lacking two bands or an active selected channel are skipped; no usable epoch returns an explicit error.

Encoding preserves FPS, automatic/manual assignments, disabled channels and EV, with the same asinh/exposure function. Captions retain epoch time, EV, RGB settings and source dates/wavelengths. Monochrome export also honors exposure. This supersedes the earlier limitation that RGB export was unavailable.

## Release catalogue and analysis laboratory

`config/spherex-releases.json` defines Level 2 IDs, labels, SIA collections, IBE product prefixes and enabled state. `defaultRelease` initializes sessions; `SPHEREX_RELEASES_FILE` can replace the file. The API validates and reloads it when mtime changes; `GET /data-releases` supplies the UI. Refreshing releases needs no frontend rebuild.

A format-compatible release can be added through configuration; a changed FITS format still needs adapter validation/tests. Different releases are not mixed within a sequence. Allowed product hosts remain HTTPS IRSA and configured prefixes.

Point samples and D1–D6 stacks open an analysis panel. `POST /sequences/:id/analyze` uses source FITS for a ready sequence owned by the session, without initiating a new archive search. Paths/manifests are server-controlled; the client supplies mode, coordinates and wavelength bounds. Optional durable storage can restore missing local source files before analysis.

### Point samples

The plot samples the nearest native pixel at the selected sky coordinates using `IMAGE - ZODI`, valid flags, WCS-WAVE wavelength/bandwidth and `sqrt(VARIANCE)` uncertainty. Units are MJy/sr surface brightness, not total source Fν. Points from different times are not connected as a continuous spectrum; detector colors and tooltips retain date/ID. Tables/CSV preserve time, detector, wavelength, value, error and source.

This is not aperture/PSF photometry, local-background subtraction, or guaranteed complete 102-channel coverage. Sufficient observations are required for broader wavelength coverage.

### Detector stacks and stack RGB

Stacks use WCS projection, quality flags and inverse-variance weighting separately by detector. Broad ranges mix wavelengths/dates. Interpolated variance is a relative weight without resampling-covariance propagation; no calibrated stack photometry or numerical S/N improvement is claimed. Each stack exposes image count, coverage, source times and PNG. A synthetic weighted-mean test yields 3.6 from values 2/10 with variances 1/4.

The stack RGB composer independently enables R/G/B and assigns any available detector stack, including reusing one. Missing detectors are marked. Default assignment uses longest/middle/shortest available ranges. Preview and downloaded PNG use the same canvas, exposure and channel state. Output is 256×256, with absent active-channel coverage transparent. Source summaries retain counts/date spans.

Stack RGB combines independently stretched PNG previews. It does not guarantee simultaneity or recover values already clipped in those PNGs.

## Epoch arithmetic, larger fields and links

“A ± B” computes A+B or B−A from `IMAGE - ZODI` after projection/quality checks. The default second observation uses the same detector and nearby wavelength where possible. Other wavelengths are allowed with warnings. Red marks positive B−A and blue negative. Output includes PNG, common coverage, MJy/sr range and both source records. Without PSF/background matching this is neither an automatic motion detector nor a calibrated significance map.

FOV accepts up to 2°. Larger single-exposure fields can have partial coverage; no automatic mosaicking is performed. Above 0.5°, the recorded download limit is 128 MiB instead of 32 MiB. The worker decodes/reprojects one native FITS at a time, retaining common 256×256 planes/metadata rather than all large inputs in memory. Larger FOV reduces angular preview resolution.

Synthetic tests cover 0.1°, 1° and 2°. Checked real products returned HTTP 503 for 1–2° and HTTP 200 for a 0.1° control cutout. Thus large-field geometry is tested synthetically, while current live large-cutout availability remains unconfirmed.

Quality details use `MSKNnnnn` names and `MSKDnnnn` descriptions from FLAGS headers with per-bit counts/percentages. SOURCE bit 21 means known source signal, not automatically a detector defect. New frame metadata preserves summaries; older sequences may read original FITS on demand.

Coordinate URLs support `ra`, `dec`, `fov`, `release`, `from`, `to`, `search=1` and `embed=1`. Both coordinates are required. Search links do not automatically retrieve every cutout. Links/iframes contain no private session identifiers. Embed mode hides side panels; cross-site browser cookies still require a deliberate hosting/session design because default sessions use SameSite=Lax. Authentication/OriginGuard are not weakened for embedding.

The Aladin Lite link opens the CDS atlas with the region/FOV. It does not load external atlas scripts into the main cockpit. FITS processing continues through Astropy/reproject.

## Earth, spacecraft and selected direction

Navigation replaces the sky image with a globe and SPHEREx position while leaving search controls available. RA/Dec/FOV changes update the selected direction immediately without a new archive search. Users can rotate/zoom the globe and offset time ±120 minutes; “Now” restores the clock. Spacecraft/FOV symbols are visually enlarged.

`GET /spacecraft-orbit` uses the fixed CelesTrak source for NORAD 63182. It validates catalogue IDs, line lengths, checksums and epoch. A two-hour cache deduplicates concurrent requests; failures may return cached data with `stale=true`. Without data, the UI uses an explicitly labelled nominal diagram. The browser refreshes every two hours. satellite.js 6 uses SGP4 within ±7 days of the TLE epoch. UTC, element epoch, altitude, speed and geographic coordinates are shown.

The arrow represents selected RA/Dec, not telescope attitude telemetry. ICRS-to-orbit direction is approximate, excluding precession/nutation. Occultation uses a spherical Earth; an unobstructed ray does not establish observability because Sun/shield/scheduling/instrument constraints are omitted. Coastlines use Natural Earth 110m.

Recorded tests cover coordinate axes, normalized direction, ray/Earth intersections, TLE identity/checksums, cache and explicit fallback. UI checks exercised TLE loading, arrow changes and time pause/resume.

## Recorded field pointing versus live attitude

No connected public live ADCS/quaternion stream was found in the sources checked during implementation. Attitude is not inferred from TLE or the selected target. Navigation therefore separates archival detector-field orientation from live orbital context and states that live body attitude is unavailable.

Authorized FITS analysis produces `recordedPointing`: ICRS at CRPIX and positive detector X/Y position angles east of north. CRPIX is not necessarily the cutout center or common telescope boresight. Astropy WCS reads the original header and converts to ICRS. Time prefers DATE-AVG, then DATE-OBS, then labelled archive metadata, respecting TIMESYS. The UI shows an axis compass, time, detector and source FITS.

Archival field rotation is not combined with current orbit as one attitude measurement. The globe arrow remains the selected direction. Hidden sky playback pauses locally in navigation to keep the inspected exposure stable. A synthetic case checks displaced CRPIX, 30° rotation and DATE-AVG precedence.

## Cutout concurrency and projection cache

Four concurrent IRSA downloads preserve requested manifest ordering. Cancellation stops further retrieval; progress does not move backwards when requests finish out of order. Response limits, timeouts and three attempts remain enforced. Do not restart an API process while it is preparing a sequence.

Projected planes are cached under `CACHE_ROOT/projections/` (default `data/cache/projections/`). Keys include source path/size/mtime, coordinates, field, grid and worker-code hash. Corrupt entries are recomputed. Contrast is recalculated for the selected sequence; scientific analyses use original FITS. Writes are atomic and do not use pickle.

A local benchmark on 20 cached real cutouts produced 19 valid frames: 1.545 seconds first processing and 0.162 seconds repeated processing, with byte-identical PNGs. These figures exclude IRSA transfer and interpreter startup and do not guarantee whole-job speedup.

## Scene time and archival exposure position

Clicking an archival grid cell freezes scene time at the exposure. The worker reads DATE-AVG/TIMESYS, `SGT_LAT_MIDPT`, `SGT_LON_MIDPT`, radius from `X_SC/Y_SC/Z_SC`, and optional speed from `VX_SC/VY_SC/VZ_SC`. Position uses a spherical Earth and the recorded ground location; raw inertial coordinates are not treated as Earth-fixed.

When a valid velocity vector exists, a two-body osculating ellipse uses the same frame/Earth time as the displayed position. Its central point matches the spacecraft marker. A minimal rotational correction anchors the approximate celestial transform to the recorded ground location. J2, drag and other perturbations are omitted; this is not a precision ephemeris. Propagation is limited to ±3 hours from exposure. Invalid/missing velocity or elements hide the trajectory. “Now” returns to TLE/SGP4.

An empty grid cell can use another band's exposure at exactly the same archival time, identifying the missing requested band and the source actually used. Missing position information remains a labelled illustration, never a fabricated actual position.

## Interface language

English is the default. EN/PL switches language without resetting frame, channels or scene time. The choice is saved as `spherex-language` in localStorage. `apps/web/src/shared/i18n/translations.en.ts` translates Polish source keys and parameterized messages. User-entered text and past conversation are not automatically translated.

## Later source additions

The current tree also includes Gaia DR3 overlays, AllWISE comparisons, CADC/NEOSSat coverage queries, cleanup and optional private object-storage persistence. Their behavior and limits are documented in the [README](../README.md). Their presence in source does not assert that every integration has been exercised in the public deployment.
