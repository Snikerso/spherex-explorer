import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { run, setTracingDisabled } from '@openai/agents';
import '../../src/load-env.js';
import { z } from 'zod';
import { AgentActions } from '../../src/modules/agent/actions.js';
import { createSkyAgent } from '../../src/modules/agent/agent.factory.js';
import { PROMPT_VERSION } from '../../src/modules/agent/instructions.js';
import type { ToolCall } from '../../src/modules/agent/ports.js';
import { FixtureObservations, MemoryWorkspace, demoSearchInput } from '../fixtures/workspace.js';

const { values } = parseArgs({ options: { repeat: { type: 'string', default: '1' } } });
const settings = z.object({
  OPENAI_API_KEY: z.string().optional(), OPENAI_MODEL: z.string().optional(),
  AGENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),
  AGENT_MAX_TURNS: z.coerce.number().int().min(1).max(12).default(8),
}).parse(process.env);
const repeat = Number(values.repeat);
if (![1, 2, 3].includes(repeat)) throw new Error('--repeat musi mieć wartość 1, 2 lub 3.');
if (!settings.OPENAI_API_KEY || !settings.OPENAI_MODEL) throw new Error('Test live wymaga OPENAI_API_KEY i OPENAI_MODEL w lokalnym .env. Nie wykonano wywołania API.');
setTracingDisabled(true);

const cases = [
  { id: 'L01', prompt: 'Pokaż WISE 0855. Wyszukaj dostępne obserwacje bez ograniczenia dat, wybierz dwie zgodne z różnych dat i przygotuj sekwencję. Na razie jej nie odtwarzaj.', expectedTools: ['get_selection', 'resolve_target', 'search_observations', 'prepare_sequence'], seed: false, expectedFps: 2 },
  { id: 'L02', prompt: 'Uruchom przygotowaną sekwencję, zachowując moje obecne tempo i wszystkie filtry.', expectedTools: ['get_selection', 'set_playback'], seed: true, expectedFps: 1 },
  { id: 'L03', prompt: 'Pokaż obiekt o nazwie Testowy Nieznany Obiekt XYZ. Nie znam jego współrzędnych.', expectedTools: ['get_selection', 'resolve_target'], seed: false, expectedFps: 2 },
];
const results = [];
for (let repetition = 1; repetition <= repeat; repetition++) {
  for (const scenario of cases) {
    const workspace = new MemoryWorkspace(); const provider = new FixtureObservations(); const calls: ToolCall[] = [];
    if (scenario.seed) {
      const seed = new AgentActions(workspace, provider, { sessionId: 'live-test', runId: 'seed', expectedRevision: 0 });
      const search = await seed.searchObservations({ targetId: 'wise-0855', input: demoSearchInput });
      await seed.prepareSequence({ searchId: search.id, observationIds: ['demo-epoch-a', 'demo-epoch-b'] });
      const current = await workspace.get('live-test');
      await workspace.patch('live-test', { fps: 1 }, current.viewRevision, 'user');
    }
    const current = await workspace.get('live-test');
    const actions = new AgentActions(workspace, provider, {
      sessionId: 'live-test', runId: `${scenario.id}-${repetition}`, expectedRevision: current.viewRevision,
      onToolCall: (call) => calls.push(call), signal: AbortSignal.timeout(settings.AGENT_TIMEOUT_MS),
    });
    const started = Date.now();
    try {
      const output = await run(createSkyAgent(actions, settings.OPENAI_MODEL), scenario.prompt, {
        maxTurns: settings.AGENT_MAX_TURNS, signal: AbortSignal.timeout(settings.AGENT_TIMEOUT_MS),
      });
      const state = await workspace.get('live-test');
      const toolsPassed = scenario.expectedTools.every((name) => calls.some((call) => call.name === name));
      const statePassed = state.fps === scenario.expectedFps && (scenario.id === 'L01' ? state.sequenceId !== null && !state.playing : scenario.id === 'L02' ? state.playing : state.sequenceId === null);
      results.push({ id: scenario.id, repetition, passed: toolsPassed && statePassed, durationMs: Date.now() - started, calls, state, finalOutput: output.finalOutput });
    } catch (error) {
      // Nie zapisujemy surowych błędów dostawcy ani konfiguracji, by nie ujawnić sekretów.
      results.push({ id: scenario.id, repetition, passed: false, durationMs: Date.now() - started, errorType: error instanceof Error ? error.name : 'UnknownError', calls });
    }
  }
}
const directory = resolve('../../output/evals'); await mkdir(directory, { recursive: true });
const filename = resolve(directory, `${new Date().toISOString().replaceAll(':', '-')}.json`);
await writeFile(filename, JSON.stringify({ model: settings.OPENAI_MODEL, promptVersion: PROMPT_VERSION, syntheticData: true, results }, null, 2));
console.info(`Raport: ${filename}. Sukcesy: ${results.filter((result) => result.passed).length}/${results.length}. Treść odpowiedzi wymaga również przeglądu człowieka.`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
