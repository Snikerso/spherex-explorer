import { Agent, tool } from '@openai/agents';
import { DomainError, pointSchema, searchInputSchema } from '@spherex/contracts';
import { z } from 'zod';
import type { AgentActions } from './actions.js';
import { SKY_INSTRUCTIONS } from './instructions.js';

async function result<T>(operation: () => Promise<T>) {
  try { return { ok: true as const, result: await operation() }; }
  catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return { ok: false as const, error: { code: error.code, message: error.message } };
  }
}

export function createSkyTools(actions: AgentActions) {
  const id = z.string().min(1).max(200);
  return [
    tool({ name: 'get_selection', description: 'Odczytaj aktualne ustawienia użytkownika i zaznaczony punkt.', parameters: z.object({}).strict(), execute: () => result(() => actions.getSelection()) }),
    tool({ name: 'resolve_target', description: 'Znajdź współrzędne obiektu w sprawdzonym katalogu.', parameters: z.object({ name: z.string().min(1).max(100) }).strict(), execute: (args) => result(() => actions.resolveTarget(args)) }),
    tool({ name: 'search_observations', description: 'Wyszukaj obserwacje i zaktualizuj widoczny formularz. RA/Dec i pole są w stopniach, daty UTC lub null.', parameters: z.object({ targetId: id.nullable(), input: searchInputSchema }).strict(), execute: (args) => result(() => actions.searchObservations(args)) }),
    tool({ name: 'prepare_sequence', description: 'Przygotuj 2–24 zgodne obserwacje bieżącego wyszukiwania. Ustaw widoczne checkboxy.', parameters: z.object({ searchId: id, observationIds: z.array(id).min(2).max(24) }).strict(), execute: (args) => result(() => actions.prepareSequence(args)) }),
    tool({ name: 'set_view', description: 'Ustaw gotową sekwencję, tryb i klatki w kontrolkach interfejsu.', parameters: z.object({ sequenceId: id, mode: z.enum(['single', 'blink', 'side_by_side']), frameIds: z.array(id).min(1).max(24) }).strict(), execute: (args) => result(() => actions.setView(args)) }),
    tool({ name: 'set_playback', description: 'Zmień play/pause i tempo 0.25–4 klatki/s w odtwarzaczu.', parameters: z.object({ playing: z.boolean(), fps: z.number().min(0.25).max(4) }).strict(), execute: (args) => result(() => actions.setPlayback(args)) }),
    tool({ name: 'save_annotation', description: 'Zapisz notatkę dla punktu wskazanego przez użytkownika. Najpierw odczytaj get_selection.', parameters: pointSchema.extend({ sequenceId: id, text: z.string().trim().min(1).max(2000) }).strict(), execute: (args) => result(() => actions.saveAnnotation(args)) }),
  ];
}

export function createSkyAgent(actions: AgentActions, model: string) {
  if (!model.trim()) throw new Error('Ustaw OPENAI_MODEL przed uruchomieniem agenta.');
  return new Agent({ name: 'SkyExplorerAgent', model, instructions: SKY_INSTRUCTIONS, tools: createSkyTools(actions) });
}
