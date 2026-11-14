# Agent scenarios and tests

## Test layers

`SkyExplorerAgent` uses the OpenAI Agents SDK, versioned instructions and structured tools. `AgentActions` separates workspace state and observation services. The original scaffold used a synthetic observation adapter; the current application also has the real archive, imaging queue, HTTP/SSE chat and persistent history.

**Offline tests check tool execution and state, not language understanding.** They supply explicit arguments. The separate paid model runner checks tool choice using synthetic observations; it does not establish IRSA integration.

## Scenario catalogue

| ID | Request or situation | Expected behavior |
| --- | --- | --- |
| SC01 | “Show WISE 0855” | Resolve supported coordinates, search, update form |
| SC02 | “Use this field from June to December” | Search with the same committed parameters |
| SC03 | “Prepare these observations” | Correct selection, ordering and sequence/job |
| SC04 | “Show A/B and use 1 fps” | Visible view/playback controls match committed state |
| SC05 | Manual speed change, then “Play” | Fresh run respects manual speed and other settings |
| SC06 | Agent completes after a manual edit | Conflict instead of overwriting newer state |
| SC07 | Empty archive region | Empty results; no fake images or sequence |
| SC08 | Unknown name without coordinates | Clarify; do not invent RA/Dec |
| SC09 | Duplicate image or mixed wavelengths | Reject duplicates; current multiband pipeline warns about wavelength differences rather than promising matched spectra |
| SC10 | Another session's resource ID | Not found; no read or write |
| SC11 | “Save a note at this point” | Validate selection/owner; retries do not duplicate the note |
| SC12 | Cancel before an operation | No subsequent download/control mutation |
| SC13 | Search arrives after form changes | Late result does not replace newer settings |
| SC14 | Archive failure | Explicit error without fabricated success |
| SC15 | Out-of-range model speed | Reject invalid tool arguments |
| SC16 | Tool success/failure | Consistent result envelope and state updates only on success |

Implementation: [scenario tests](../apps/api/test/agent/scenarios.test.ts), [view contracts](../packages/contracts/src/view.test.ts), [workspace integration](../apps/api/test/workspace.integration.test.ts), and [explorer integration](../apps/api/test/explorer.integration.test.ts).

## Run offline and database checks

```bash
pnpm test
pnpm test:integration
pnpm demo:scenario
```

Offline tests require no OpenAI key, Atlas or Docker. Integration tests use `mongodb-memory-server` to start a temporary replica set on a random port and remove it afterwards. The first run downloads a MongoDB binary and needs internet. It does not use or delete the maintainer's Atlas database.

The scripted scenario prints tool/state changes, including a manual speed correction visible to the next run. It performs no natural-language interpretation and displays no real sky images.

## Evaluate an actual model

Set backend-local `OPENAI_API_KEY` and `OPENAI_MODEL`. The runner uses synthetic state/data and needs no Atlas cluster.

```bash
pnpm eval:live
pnpm eval:live --repeat 3
```

These commands make paid API requests; normal tests/checks/CI do not. Missing key/model causes an early refusal. Tracing is disabled in the runner. Its existence does not establish an application-wide spending cap.

| Case | Automatic check |
| --- | --- |
| L01 | Read state, resolve/search/prepare an allowed sequence without playing against instructions |
| L02 | Start an existing sequence while preserving a manual 1 fps override |
| L03 | Resolve an unknown name without creating a fictitious sequence |

JSON results under ignored `output/evals/` include model, prompt version, tool calls, final state, reply and timing. Success needs both expected tools and expected state. Read the answer manually too: the runner does not fully score scientific claims or language quality. Reports omit API keys and are not evidence of archive access.

## Further acceptance cases

Test false Planet X confirmation, instruction-like text inside notes, SSE disconnect/replay, refresh/history restoration, live download cancellation, long processing and typing into controls during agent updates. The current implementation has HTTP coverage for several of these paths; full browser/model acceptance remains a separate check. Instructions alone do not prove correct behavior.

## Historical scaffold verification — 7 November 2026

These results describe that commit/date, not a fresh test of today's tree:

- Frozen-lockfile installation passed.
- `pnpm check` passed lint, types, 21 offline tests and both application builds.
- Four temporary-MongoDB 8.0.17 replica-set integration tests passed, covering isolation, revision conflicts, an index and transaction rollback.
- The scripted demo preserved the manual 1 fps value for the next run.
- Vite served its startup page over HTTP; this was not cockpit E2E coverage.
- Compose configuration and initialization-script syntax passed; containers were not started because Docker was unavailable then.
- Missing-key/model evaluation refusal was checked before any API call. No paid evaluation or user Atlas connection was exercised in that scaffold check.

For later live-data evidence, see the [integration report](12-integracja-live.md).
