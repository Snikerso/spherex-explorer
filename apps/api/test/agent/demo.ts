import { AgentActions } from '../../src/modules/agent/actions.js';
import { FixtureObservations, MemoryWorkspace, demoSearchInput } from '../fixtures/workspace.js';

const workspace = new MemoryWorkspace(); const provider = new FixtureObservations();
console.info('DEMO TECHNICZNE: skrypt narzędzi, dane syntetyczne, bez modelu i bez połączenia z IRSA.');
const actions = new AgentActions(workspace, provider, {
  sessionId: 'demo-session', runId: 'demo-run', expectedRevision: 0,
  onViewUpdate: ({ state, changedFields }) => console.info(JSON.stringify({ changedFields, revision: state.viewRevision, source: state.lastChangedBy, fps: state.fps, selectedObservationIds: state.selectedObservationIds })),
});
const target = await actions.resolveTarget({ name: 'WISE 0855' });
const search = await actions.searchObservations({ targetId: target.id, input: demoSearchInput });
await actions.prepareSequence({ searchId: search.id, observationIds: ['demo-epoch-b', 'demo-epoch-a'] });
await actions.setPlayback({ playing: true, fps: 2 });
const before = await workspace.get('demo-session');
const edited = await workspace.patch('demo-session', { fps: 1 }, before.viewRevision, 'user');
console.info('Ręczna poprawka użytkownika:', JSON.stringify({ fps: edited.fps, source: edited.lastChangedBy, revision: edited.viewRevision }));
const next = new AgentActions(workspace, provider, { sessionId: 'demo-session', runId: 'next-run', expectedRevision: edited.viewRevision });
console.info('Stan dostępny dla kolejnego polecenia:', JSON.stringify(await next.getSelection(), null, 2));
