# Interface — observation cockpit

## Design direction

The author chose a modern spacecraft-cockpit layout: a large central image, side consoles and a lower control area, based on a personal sketch. The original inspiration was an X-wing-like viewing station. This is an independent data-exploration application, not an official mission-operations console.

The sketch establishes layout; colors, proportions and component names below are design guidance rather than proof of implemented accessibility/performance. Real application observations come from IRSA.

## Design references

- [Author's sketch](assets/kokpit-szkic.jpg).
- [AI-generated concept mockup](assets/kokpit-koncepcja-v1.png), produced with imagegen using the sketch as reference.
- Original prompt records: [generation](assets/kokpit-prompt.txt) and [correction](assets/kokpit-prompt-korekta.txt). These historical prompt files retain their original wording.

The mockup contains illustrative stars, values and messages. It is not a screenshot of real observations. Treat it as an AI-generated design asset; label it visibly before including it in submitted media. It is linked rather than embedded here to avoid presenting it as a finished scientific view.

## Layout

```text
Header: project / source status / language / UTC
Navigation     | Main image, A/B or globe | Instruments / metadata
Search & list  | Zoom, selection, RGB     | Quality / notes
Timeline: previous / play-pause / next / frame / speed
Copilot: request, conversation, operation status, Stop
```

The image should dominate. Original desktop guidance allocated approximately 180–240 px to the expandable lower console; actual space must be checked with real controls. Decorative outer corners may be angled, while images, text and forms remain rectangular and unobstructed. A fullscreen viewer can maximize the data region.

| Area | Content |
| --- | --- |
| Header | Project, target, actual connection/source state, language |
| Navigation | Examples, RA/Dec, field size, dates, releases, search and observation selection |
| Main view | Images, markers, scale/orientation, dates, zoom/pan, fit and synchronized A/B |
| Instruments | View mode, spectral context, provenance and quality |
| Selection | Sky position, clear selection, note input and saved notes |
| Timeline | Frame position, previous/next, play/pause, speed and uneven-time information |
| Copilot | Messages, input, send/stop and tool progress |
| Operation status | Preparation progress, cancellation, retry and coordinate links |

The current navigation tab also provides a 3D globe. WebGL is used for this feature, not as a requirement for rendering every cockpit control.

## Editable copilot actions

Every core agent operation has a manual counterpart. Search updates visible coordinates/dates; preparation updates observation selection; view/playback tools update mode, frames and speed; notes use the same selected point.

The user can change 2 fps to 1 fps, edit dates or deselect observations. Speed applies immediately; dates require Search and selection requires preparation. Distinguish the displayed sequence's actual parameters from an edited form. Optional brief highlighting may identify copilot changes, but values remain ordinary editable controls.

Preserve local input drafts and reject late changes based on stale revisions. On refresh restore committed settings. Read fresh state before the next agent run, including manual corrections.

## Visual guidance

| Element | Original design token |
| --- | --- |
| Background | Graphite `#080D14` |
| Console / raised surface | `#111B28` / `#192638` |
| Borders | Steel `#33465E` |
| Active/focus | Cyan `#5DDDEB` |
| Warnings | Amber `#F6B85A` |
| Main / secondary text | `#E8F0F8` / `#A5B6C9` |
| Error | `#FF818A`, plus icon and description |

Actual theme variables can evolve. Use readable sans-serif for interaction/chat and monospace for coordinates/dates/numbers. The data palette stays independent of the cockpit palette. Markers should be hideable. The project icon uses six abstract spectral bars; do not reintroduce a NASA-like round badge, swoosh or altered NASA lettering. Tagline: **EXPLORE NASA SPHEREx OPEN DATA**.

## Motion and accessibility

Use brief transitions around 120–180 ms and respect reduced-motion preferences. Show real loading stages and elapsed time when a percentage is unknown. Playback starts deliberately and pause remains available. Avoid decorative flicker, scanlines, fake radar readings and unrequested sound.

Original responsive targets: full side consoles around 1440 px, collapsible panels below about 1280 px, and separate tabs on phones. Validate actual styles rather than treating these as exact implemented breakpoints. Do not scale the entire desktop cockpit down to fit mobile.

Controls need accessible names, keyboard operation and visible focus. Do not communicate status solely by color. Original text-size goals were at least 14 px for body text and preferably 16 px for chat; verify contrast and zoom with the final theme. Player shortcuts must not interfere with text entry.

## Implementation and acceptance

Use CSS Grid, CSS/SVG decoration and canvas where image composition needs it; keep forms/chat in the DOM. A raster concept image must not become a fake interactive background. React components receive explicit state/props; orbital math and GPU lifetime handling remain separate.

Acceptance requires readable dates and sources, working manual and conversational paths sharing state, polished empty/error/cancel states, protection of newer edits, and usable small-screen/zoom/keyboard layouts. The existence of a mockup alone satisfies none of these interaction criteria.
