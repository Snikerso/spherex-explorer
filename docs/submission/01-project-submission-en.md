# SPHEREx Explorer — submission text

Prepared on 14 November 2026 for **Planet X and SPHEREx**. Copy the sections below into the corresponding project form fields. Replace every `TODO` before submitting. This is a draft, not a confirmation of submission or public availability.

## Project Name

SPHEREx Explorer

## High-Level Project Summary

SPHEREx Explorer is a browser-based workspace for exploring real NASA SPHEREx observations across time and infrared wavelengths. Users enter sky coordinates or select an example target, retrieve archival observations, and compare images through blink playback, side-by-side views, and false-color composites. A text copilot operates the same controls as the user, making the workflow approachable while keeping manual control available. Source identifiers, observation times, and wavelengths remain visible. The project addresses Planet X and SPHEREx by making archival sky comparisons easier to explore and explain. It supports visual investigation and candidate follow-up; it does not claim to discover Planet X or confirm moving objects automatically.

## Link to Project Demo

TODO_PUBLIC_DEMO_URL

Use a video of **30 seconds or less**, or a presentation of **no more than seven slides**, including title slides. The link must work without an account or access request.

## Link to Final Project

https://github.com/Snikerso/spherex-explorer

Verify anonymous access and publish the final documentation before using this link. The English project guide is `docs/submission/03-project-guide-en.md`. If a public application is available, add its verified URL to that guide. Public application supplied by the author: https://spherex-explorer-l9m4r.ondigitalocean.app/ . Check access before submission.

## Detailed Project Description

### The problem and my approach

Finding changes in astronomical archives requires more than opening two pictures. Observations can differ in time, wavelength, orientation, coverage, and quality. SPHEREx Explorer brings the search, image preparation, comparison, and source information into a single interactive workspace. My intended audience includes curious visitors, students, and astronomy enthusiasts who want to investigate real observations without first building an image-processing pipeline.

### What users can do

Users search by right ascension and declination, field of view, release, and optional dates. Presets include Barnard’s Star, Epsilon Indi B, WISE 0855, RW Aurigae, and R Draconis. They select observations, prepare a sequence, and inspect blink playback or synchronized A/B views. A detector-and-time grid shows which observations are available. False-color RGB composition, exposure adjustment, and MP4 export help communicate an investigation.

Additional exploratory tools include per-detector stacks, point samples plotted against wavelength, and addition or subtraction of two epochs. Users can inspect metadata and quality flags, select a sky position, and save session notes. Coordinate links reopen a search context; they do not publish a private session, its images, or its chat history.

A text copilot uses structured backend tools to search observations and operate the same application state as the manual controls. Users can adjust a setting themselves and continue the conversation. The language model does not generate replacement astronomical observations.

### How it works

The frontend uses React and TypeScript. A NestJS backend stores session state, searches, notes, jobs, and copilot history in MongoDB. It queries the IRSA SIA2 archive for SPHEREx Level 2 products. A Python worker uses Astropy, NumPy, and reproject to read FITS cutouts, interpret WCS, subtract the ZODI model, and project images onto a common TAN sky grid. Shared contrast supports visual comparison. The OpenAI Agents SDK connects natural-language requests to explicit application tools; the API key stays on the server.

The navigation view provides educational context using SPHEREx orbital elements from CelesTrak and SGP4 propagation. Archival detector pointing is read separately from FITS WCS metadata. A selected sky direction is not live spacecraft attitude telemetry.

### NASA data and traceability

The application uses real SPHEREx Level 2 observations served by NASA/IPAC IRSA. DR1 and QR3 are configured archive releases. Each investigation retains source product references, dates, detector information, and wavelengths. Existing local verification records searches for all five challenge example fields and preparation of real image sequences. These records establish archive access and processing, not detection of the named objects.

### Benefits and next steps

The contribution is an accessible workflow combining real archive data, manual inspection, and a copilot that shares the user's controls. The same workspace helps users ask a question, inspect a comparison, and explain its provenance. Future work includes PSF and background matching, validated motion measurements with uncertainties, and stronger workflows for candidate follow-up.

### Scientific and operational limitations

Current playback can include different wavelengths and different spatial coverage. Apparent changes can therefore be spectral, instrumental, or processing effects rather than motion or variability. RGB colors are assigned for visualization and need not represent simultaneous observations. Point samples are surface-brightness measurements, not aperture or PSF photometry of a source. Stacks may combine wavelengths and dates. Difference images have no PSF matching or calibrated significance model.

Search results for a field do not establish that the target is detected. I do not claim a new object, a Planet X discovery, an orbit determination, or a confirmed moving-source detection. Large-field archive cutout availability is not fully verified. Image preparation depends on external archive availability and uses a local queue requiring one API process. Public hosting and anonymous access must be checked separately before submission.

## Use of Super Intelligence (SI)

The application uses OpenAI language models through the OpenAI Agents SDK as a text copilot. The copilot translates requests into structured application operations and explains their returned results. Astronomical images come from the SPHEREx archive and are processed by conventional numerical code; they are not generated by a language or image model.

I developed the project as a solo participant. OpenAI Codex assisted with software development, debugging, and preparing and editing project documentation and submission materials. I must complete the following record before submission so that it describes all actual SI use, including code and visual assets:

- Development assistance: OpenAI Codex supported implementation, debugging, and documentation under my direction. Confirm any additional assistants/models and their actual contributions before submission.
- TODO_SI_MEDIA: the original cockpit concept mockup was generated with imagegen from my sketch. Confirm whether it or any other SI-generated media is included in the final project/demo. Mark generated images/video visibly and acknowledge generated audio in its description and metadata.
- TODO_ORIGIN: identify the human origin of my solution idea and confirm the actual division of my work and SI assistance. Do not assert unverified authorship or originality.

For SI-assisted code and data, include an acknowledgement in descriptive documentation and the relevant metadata. Do not apply NASA branding to SI-generated assets. Check the final disclosure against the guide and my actual work history.

## NASA Data

I use SPHEREx Level 2 spectral-image products from NASA/IPAC Infrared Science Archive (IRSA), queried using SIA2 and retrieved as FITS cutouts. The processing reads astronomical images, the ZODI model, variance, quality flags, and spatial/spectral WCS metadata. These support sky-coordinate alignment, observation playback, visual composites, and exploratory analysis.

- Mission/archive: https://irsa.ipac.caltech.edu/Missions/spherex.html
- Archive access: https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/
- Cutout documentation: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html
- Release information: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html
- Quality flags and products: https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html

The project configures DR1 and QR3 separately and does not combine releases within one sequence. TODO_DATA_CREDIT: add the applicable release DOI and exact required acknowledgement for every release used in the final demo, verified against that release's documentation. Do not assume the QR acknowledgement covers DR1.

## Space Agency Partner Data and Other References

The current source also includes ESA Gaia DR3 catalogue overlays and CADC/NEOSSat coverage queries. Include them in the final resource list when they are part of the submitted version; their presence in source is not a fresh live verification.

Data and scientific resources:

- ESA Gaia DR3: https://gea.esac.esa.int/archive/documentation/GDR3/
- AllWISE reference data: https://irsa.ipac.caltech.edu/ibe/docs/wise/allwise/p3am_cdd/
- CADC TAP / NEOSSat coverage: https://www4.cadc.hia.nrc.gc.ca/en/doc/tap/

- CelesTrak SPHEREx orbital elements, NORAD 63182: https://celestrak.org/NORAD/elements/gp.php?CATNR=63182&FORMAT=TLE
- Natural Earth geographic outlines: https://www.naturalearthdata.com/
- CDS Aladin Lite, external sky-atlas link: https://aladin.cds.unistra.fr/AladinLite/

Software and tools:

- React: https://react.dev/ ; Vite: https://vite.dev/
- TypeScript: https://www.typescriptlang.org/ ; NestJS: https://nestjs.com/
- MongoDB / Mongoose: https://www.mongodb.com/ ; https://mongoosejs.com/
- OpenAI Agents SDK for TypeScript: https://openai.github.io/openai-agents-js/
- Astropy: https://www.astropy.org/ ; reproject: https://reproject.readthedocs.io/
- NumPy: https://numpy.org/ ; SciPy: https://scipy.org/
- Pillow: https://python-pillow.org/ ; imageio-ffmpeg: https://github.com/imageio/imageio-ffmpeg ; FFmpeg: https://ffmpeg.org/
- Three.js: https://threejs.org/ ; satellite.js: https://github.com/shashwatak/satellite-js
- Astronomy Engine: https://github.com/cosinekitty/astronomy
- Development/documentation assistance: OpenAI Codex; complete the SI record above.

Dependency manifests and lockfiles in the final repository identify the full package set and versions. TODO_ASSET_CREDITS: audit the final demo, screenshots, fonts, images, copied text/code, and other assets; add their authors, source URLs, licenses, and any permissions. Include only resources actually used. No complete asset-rights audit is claimed here.
