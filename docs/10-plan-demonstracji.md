# Demonstration plan

## Submission format

The [2026 submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) requires a video of **30 seconds or less**, or **at most seven slides**, including title/intro slides. A three-minute walkthrough must not be used as the required project demo. Use the [English demo script](submission/02-demo-en.md) and [submission checklist](submission/00-checklista-pl.md).

## Project story

“I built SPHEREx Explorer to make real infrared archive observations easier to compare. The workspace combines images, source metadata and a copilot that shares the manual controls, so users can ask questions and adjust the investigation themselves.”

The demonstration should show real operations and real data. The current application supports archive images, blink/A-B, RGB, exploratory analysis and the copilot. A design mockup, recorded run and synthetic tool test must each be labelled accurately. Do not imply that a target-field search detects the named object.

## Optional extended technical walkthrough — approximately three minutes

| Time | Show | Message |
| --- | --- | --- |
| 0:00–0:20 | Workspace and problem | Compare the same region across observation dates |
| 0:20–0:50 | Search request and visible form updates | Copilot operations use ordinary editable controls |
| 0:50–1:20 | Real images, dates, sources, blink and A/B | Geometry is aligned; wavelengths still need inspection |
| 1:20–1:50 | Set 2 fps by chat, then change manually to 1 | User and copilot share the same player |
| 1:50–2:15 | Follow-up command and selected-point note | Manual corrections inform the next operation |
| 2:15–2:40 | Metadata, quality and coordinate link | Trace sources; the link is not a private-session snapshot |
| 2:40–3:00 | Stack and limitations | React, NestJS, MongoDB, Python and Agents SDK; findings need validation |

This is optional additional material. Do not promise visible motion of a particular target before checking its actual frames. An example may demonstrate comparison without proving variability.

## Recording checklist

- [ ] Choose real usable observations; record release, product IDs, dates, wavelengths, coverage and pipeline settings.
- [ ] Rehearse at the final recording resolution; keep dates and sources readable.
- [ ] Prepare cache and a reproducible starting state; hide secrets/admin views.
- [ ] Check database access, backend readiness and the archive.
- [ ] Run appropriate checks and explicitly budget any paid model evaluation.
- [ ] Rehearse exact commands, manual override and reset.
- [ ] Verify release DOI/acknowledgements and media credits.
- [ ] Record a real fallback sequence; identify cached data or recordings clearly.
- [ ] Confirm English material/subtitles, SI media labels, permitted branding, and final duration/slide count.

## Fallbacks

| Failure | Presentation |
| --- | --- |
| Slow/unavailable IRSA | Previously retrieved real frames with sources and cache status |
| Unavailable OpenAI | Manual controls or an explicitly labelled recording |
| Unavailable Atlas | Prepared local environment or recording, without claiming active remote persistence |
| No visible expected change | Demonstrate the comparison and explain the limit |
| Missing feature | Label it as planned; never pretend a mockup is implementation |

## Final package

Prepare the compliant hosted demo, English form description, public application/repository links, usage instructions, solo authorship/AI disclosure, NASA and third-party credits, limitations and future work. Test links without authentication. Saving progress is not submission for judging.

`pnpm demo:scenario` is a synthetic console test of tool/state flow, not the required scientific demo. Use `pnpm dev` for the actual application and follow the README for configuration.
