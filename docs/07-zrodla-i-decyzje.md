# Sources, assumptions and decisions

The original research baseline was checked on 7 November 2026; implementation notes were updated on 14 November. External references describe APIs and requirements, not proof that a feature or target detection has been verified. No fresh external-source audit is implied by this English documentation update.

## References

| Source | Use |
| --- | --- |
| [Official Planet X and SPHEREx challenge](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/) | Goals, example targets and optional extensions |
| [HackAthlone challenge copy](https://hackathlone.com/challenges/planet-x-and-spherex) | Historical comparison when the official page failed; official text takes precedence |
| [IRSA SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html) | Mission archive and release access |
| [SPHEREx archive access](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/) | SIA2, collections and products |
| [IRSA cutouts](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html) | FITS region retrieval and metadata |
| [Data Explorer overview](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html) | Observations, detectors and wavelength coverage |
| [Quick Release overview](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html) | QR release DOI and acknowledgement; verify DR1 credits separately |
| [SPHEREx products](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html) | FITS products and flags |
| [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/) | Agent definitions, tools, running and tracing |
| [Vite](https://vite.dev/guide/) | Frontend development/build |
| [NestJS MongoDB](https://docs.nestjs.com/techniques/mongodb) | Mongoose integration |
| [MongoDB atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/) | Revision updates and transactions |
| [MongoDB limits](https://www.mongodb.com/docs/manual/reference/limits/) | BSON/document design |
| [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) | Provider-managed replication and plan limits |
| [Astropy WCS](https://docs.astropy.org/en/stable/wcs/) / [reproject](https://reproject.readthedocs.io/) | Sky-coordinate transformations and alignment |
| [Gaia DR3](https://gea.esac.esa.int/archive/documentation/GDR3/) | Catalogue positions, motion and measurements |
| [AllWISE IBE](https://irsa.ipac.caltech.edu/ibe/docs/wise/allwise/p3am_cdd/) | Reference intensity images |
| [CADC TAP](https://www4.cadc.hia.nrc.gc.ca/en/doc/tap/) | NEOSSat coverage metadata |
| [CelesTrak](https://celestrak.org/NORAD/elements/gp.php?CATNR=63182&FORMAT=TLE) | SPHEREx orbital elements |
| [Natural Earth](https://www.naturalearthdata.com/) | Geographic outlines for the globe |
| [Astronomy Engine](https://github.com/cosinekitty/astronomy) | Astronomical calculations |
| [Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) | Form, language, SI disclosure and demo rules |

During original research, the official challenge failed in the source browser; its HTML payload was read directly and compared with the local-event copy. The copy did not change the scope.

## Decisions

| Decision | Status |
| --- | --- |
| React, NestJS, MongoDB, TypeScript Agents SDK | Author-selected stack |
| MongoDB Atlas Free; local replica set optional | Selected database approach; credentials stay private |
| Cockpit-inspired interface based on the author's sketch | Selected direction; decoration must not hide data or imply official mission control |
| One backend agent using the same services as manual controls | Implemented architecture |
| Python for FITS/WCS | Implemented numerical worker |
| Mongoose, pnpm monorepo, Vite, shared Zod contracts | Implemented foundation |
| DR1/QR3 release catalogue | Current configuration; no automatic mixing of releases |
| Anonymous isolated sessions | Implemented; no account system required for the viewer |
| One API instance/local preparation queue | Current operational constraint |
| Optional private S3-compatible persistence | Current-source capability; deployment must map configuration explicitly |
| Public immutable snapshots and distributed jobs | Planned |
| Quantitative scientific thresholds, complete licensing and final release credits | Require explicit validation/decisions |

The original plan preferred a spectrally matched sequence. Current playback intentionally retains differing wavelengths and explains the consequence; this expands visual exploration without establishing time variability.

## Risks and response

| Risk | Response |
| --- | --- |
| Too few useful observations | Verify a real example first; show empty results honestly |
| Rotation, wavelength, calibration, PSF or background mimics change | Common geometry and visible metadata; calibrated comparisons need additional validation |
| Large FITS and archive latency | Cutouts, bounded concurrency, caching, cancellation and timeouts |
| Model misinterprets a request | Strict tools, shared services, evaluations and fresh state |
| Public model costs | Rate/concurrency limits and usage measurement; validate budget enforcement separately |
| SDK/archive changes | Lockfiles, contract fixtures and explicit external smoke tests |
| Ephemeral hosting | Private object persistence and restart recovery; one process until queue redesign |

## Attribution, authorship and AI

Include source product IDs, dates, release and DOI in the final demo's manifest. Copy required release-specific acknowledgements from the applicable archive release documentation; do not assume Quick Release wording covers DR1. Third-party catalogue/software/image licenses remain applicable even when resources are freely accessible.

The author participated as a solo developer. OpenAI Codex assisted with development, debugging and documentation; OpenAI models power the optional copilot. The conceptual cockpit mockup was generated with imagegen from the author's sketch. It is a design illustration, not observational evidence. Final SI-assisted media need the disclosures/labels required by the submission guide. Archive images processed numerically are not synthetic astronomical observations.

A complete asset audit and project code-license choice remain open. Public repository access alone does not grant a code license. Do not use a NASA-like badge as project branding; the current source replaces it with an original six-band icon and a descriptive open-data tagline.
