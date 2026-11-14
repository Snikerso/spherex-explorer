# Scope and requirements

## Goal and challenge

Help people without an astronomy background compare real images of the same sky region. The copilot performs application operations: finding observations, preparing a sequence, changing the view, and saving a note.

The [Planet X and SPHEREx challenge](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/) asks for a public web tool accepting RA/Dec, displaying successive SPHEREx images, and helping users notice changes. Example targets are Barnard’s Star, Epsilon Indi B, WISE 0855, RW Aurigae, and R Draconis. Optional directions include field-of-view selection, bands, image arithmetic, spectra, Gaia/WISE overlays, metadata, and URL coordinates.

This document retains the original acceptance goals. The agent and session design are my solution choices. Current implementation and departures from the original plan are recorded in the [integration report](12-integracja-live.md).

## Audience

- Visitors: enter a request, view playback, and understand basic metadata.
- Astronomy enthusiasts: choose coordinates, filter observations, and save annotations.
- The project author: prepare reproducible examples, diagnose data issues, and demonstrate the workflow.

## Original MVP acceptance criteria

| ID | Feature | Acceptance criterion |
| --- | --- | --- |
| F01 | Region search | RA/Dec and field size; degree validation and optional sexagesimal entry; clear errors |
| F02 | Example targets | Each target has a coordinate source and epoch |
| F03 | SPHEREx integration | Real observations with time, release, detector, wavelength and provenance |
| F04 | Frame preparation | Common sky grid; documented spectral policy and normalization |
| F05 | Time player | Play/pause, previous/next, speed and dates; a verified example with two distinct epochs |
| F06 | A/B comparison | Blink and side-by-side with shared zoom/pan |
| F07 | Text chat | Streaming, conversation history, cancellation and operation status |
| F08 | Shared controls | Agent changes update visible controls; manual changes remain editable and inform the next run |
| F09 | Metadata and limits | Sources, dates, coverage, quality, empty results and insufficient comparison data are explicit |
| F10 | Notes and sharing | Sky-coordinate note; planned public snapshot excluding conversation history |
| F11 | Public service | HTTPS, isolated sessions, usage limits and a rehearsed demo |

F10 is only partially implemented: coordinate links recreate a search context, not an image/session snapshot. The current multiband playback permits differing wavelengths and warns about their interpretation; it does not promise spectrally matched frames.

## Original extensions and exclusions

P1 proposed PSF/background-aware difference images, displacement measurements with uncertainty, catalogue overlays, annotation export, larger fields, and mosaics. P2 proposed photometry, light curves, spectra, candidate suggestions, accounts, collaboration, and a larger job queue. Some exploratory versions now exist; their presence does not establish calibrated scientific measurements.

Confirmed discoveries, orbit determination from two frames, a complete all-sky search, and training a custom detection model remain outside scope.

## Main workflow

1. Ask: “Show WISE 0855 and compare available observations.”
2. Resolve the example coordinates and query the archive.
3. Select observations and prepare images; show progress and cancellation.
4. Open playback or A/B; adjust manually or ask the copilot to slow down.
5. Select a sky position and save a note.
6. Retain observation references and processing parameters; share coordinates if needed.

A search around WISE 0855 is not evidence that WISE 0855 itself is visible. If data are missing, show the empty result and suggest another region or example. Never substitute generated astronomical images.

Agent-selected coordinates, dates, observations, mode and speed appear in the same manual controls. Date changes require a new search; observation changes require preparation; playback speed changes immediately. Restore committed state after refresh and protect unfinished input from late events.

## Interface and quality goals

The [cockpit interface](08-interfejs-kokpit.md) has navigation/search, a central image, instruments/notes, a timeline, and a copilot. Mobile uses tabs rather than shrinking the desktop layout.

Original performance targets were UI readiness within 3 seconds, a cached first frame within 5 seconds, and smooth 2 fps playback after loading. These are goals, not guarantees. Live archive requests show progress and timeout state. Dates remain visible, uneven time spacing is explained, keyboard focus is clear, and playback starts deliberately. Any availability claim by the copilot must follow a tool result; an apparent change remains a candidate for verification.
