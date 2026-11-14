import { Agent, tool } from '@openai/agents';
import { DomainError, pointSchema, searchInputSchema } from '@spherex/contracts';
import { z } from 'zod';
import type { AgentActions } from './actions.js';
import { SKY_INSTRUCTIONS } from './instructions.js';

async function result<T>(actions: AgentActions, name: string, operation: () => Promise<T>) {
  try {
    const value = await operation();
    actions.toolResult(name, true);
    return { ok: true as const, result: value };
  } catch (error) {
    actions.toolResult(name, false);
    if (!(error instanceof DomainError)) throw error;
    return { ok: false as const, error: { code: error.code, message: error.message } };
  }
}

export function createSkyTools(actions: AgentActions) {
  const id = z.string().min(1).max(200);
  return [
    tool({
      name: 'lookup_gaia',
      description:
        'Find Gaia DR3 candidate neighbors within 72 arcsec of the selected point. Returns catalog-epoch measurements; not a confirmed identification. Requires a selected point.',
      parameters: z.object({}).strict(),
      execute: () => result(actions, 'lookup_gaia', () => actions.lookupGaia()),
    }),
    tool({
      name: 'get_selection',
      description: 'Odczytaj aktualne ustawienia użytkownika i zaznaczony punkt.',
      parameters: z.object({}).strict(),
      execute: () => result(actions, 'get_selection', () => actions.getSelection()),
    }),
    tool({
      name: 'resolve_target',
      description:
        'Rozpoznaj nazwę obiektu: przykłady, a potem CDS Sesame. Zwraca zweryfikowane RA/Dec w stopniach do natychmiastowego search_observations.',
      parameters: z.object({ name: z.string().min(1).max(100) }).strict(),
      execute: (args) => result(actions, 'resolve_target', () => actions.resolveTarget(args)),
    }),
    tool({
      name: 'search_observations',
      description:
        'Wyszukaj obserwacje i zaktualizuj widoczny formularz. RA/Dec i pole są w stopniach, daty UTC lub null.',
      parameters: z.object({ targetId: id.nullable(), input: searchInputSchema }).strict(),
      execute: (args) =>
        result(actions, 'search_observations', async () => {
          const search = await actions.searchObservations(args);
          const counts = new Map<string, number>();
          const observations = search.observations
            .filter((item) => {
              const count = counts.get(item.comparisonGroup) ?? 0;
              counts.set(item.comparisonGroup, count + 1);
              return count < 500;
            })
            .map((item) => ({
              id: item.id,
              observedAtUtc: item.observedAtUtc,
              comparisonGroup: item.comparisonGroup,
              detector: item.detector,
              release: item.release,
            }));
          return {
            ...search,
            observations,
            total: search.total ?? search.observations.length,
            toolSubset: observations.length < search.observations.length,
            sourceUrl: 'https://irsa.ipac.caltech.edu/Missions/spherex.html',
          };
        }),
    }),
    tool({
      name: 'select_observations',
      description:
        'Zaznacz chronologicznie obserwacje wskazanego detektora (np. SPHEREx-D1), z różnych czasów. Identyfikatory wybiera serwer.',
      parameters: z
        .object({
          detector: z.enum([
            'SPHEREx-D1',
            'SPHEREx-D2',
            'SPHEREx-D3',
            'SPHEREx-D4',
            'SPHEREx-D5',
            'SPHEREx-D6',
          ]),
          limit: z.number().int().min(2).max(500),
        })
        .strict(),
      execute: (args) =>
        result(actions, 'select_observations', () => actions.selectObservations(args)),
    }),
    tool({
      name: 'prepare_sequence',
      description:
        'Zleć przygotowanie co najmniej 2 obserwacji. Po select_observations użyj observationIds=null, aby użyć zatwierdzonego zaznaczenia bez przepisywania identyfikatorów.',
      parameters: z
        .object({ searchId: id, observationIds: z.array(id).min(2).max(500).nullable() })
        .strict(),
      execute: (args) =>
        result(actions, 'prepare_sequence', async () =>
          actions.prepareSequence({
            searchId: args.searchId,
            observationIds:
              args.observationIds ?? (await actions.getSelection()).selectedObservationIds,
          }),
        ),
    }),
    tool({
      name: 'get_sequence',
      description: 'Sprawdź stan przygotowania i metadane sekwencji należącej do użytkownika.',
      parameters: z.object({ sequenceId: id }).strict(),
      execute: (args) => result(actions, 'get_sequence', () => actions.getSequence(args)),
    }),
    tool({
      name: 'set_view',
      description: 'Ustaw gotową sekwencję, tryb i klatki w kontrolkach interfejsu.',
      parameters: z
        .object({
          sequenceId: id,
          mode: z.enum(['single', 'blink', 'side_by_side']),
          frameIds: z.array(id).min(1).max(500),
        })
        .strict(),
      execute: (args) => result(actions, 'set_view', () => actions.setView(args)),
    }),
    tool({
      name: 'set_playback',
      description: 'Zmień play/pause i tempo 0.25–4 klatki/s w odtwarzaczu.',
      parameters: z.object({ playing: z.boolean(), fps: z.number().min(0.25).max(4) }).strict(),
      execute: (args) => result(actions, 'set_playback', () => actions.setPlayback(args)),
    }),
    tool({
      name: 'save_annotation',
      description:
        'Zapisz notatkę dla punktu wskazanego przez użytkownika. Najpierw odczytaj get_selection.',
      parameters: pointSchema
        .extend({ sequenceId: id, text: z.string().trim().min(1).max(2000) })
        .strict(),
      execute: (args) => result(actions, 'save_annotation', () => actions.saveAnnotation(args)),
    }),
  ];
}

export function createSkyAgent(
  actions: AgentActions,
  model: string,
  reasoningEffort: 'low' | 'medium' | 'high' = 'low',
) {
  if (!model.trim()) throw new Error('Ustaw OPENAI_MODEL przed uruchomieniem agenta.');
  return new Agent({
    name: 'SkyExplorerAgent',
    model,
    instructions: SKY_INSTRUCTIONS,
    modelSettings: {
      reasoning: { effort: reasoningEffort },
      parallelToolCalls: false,
      maxTokens: 4000,
    },
    tools: createSkyTools(actions),
  });
}
