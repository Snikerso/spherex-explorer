import { queryGaia } from '../catalogs/gaia.js';
import { Inject, Injectable, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { run, setTracingDisabled, type AgentInputItem } from '@openai/agents';
import { randomUUID } from 'node:crypto';
import { DomainError, type Message, type RunEvent } from '@spherex/contracts';
import { Store } from '../../database/store.js';
import { settings } from '../../config.js';
import { WorkspaceService } from '../workspace/workspace.service.js';
import { ObservationsService } from '../observations/observations.service.js';
import { AgentActions } from './actions.js';
import { createSkyAgent } from './agent.factory.js';

export type AgentRun = { id: string; sessionId: string; clientRequestId: string; active: boolean; status: 'running' | 'completed' | 'failed' | 'cancelled'; createdAt: Date };
@Injectable()
export class AgentService implements OnModuleInit, OnModuleDestroy {
  private readonly controllers = new Map<string, AbortController>();
  constructor(@Inject(Store) private readonly store: Store, @Inject(WorkspaceService) private readonly workspace: WorkspaceService, @Inject(ObservationsService) private readonly observations: ObservationsService) { setTracingDisabled(true); }
  get available() { return Boolean(settings.OPENAI_API_KEY && settings.OPENAI_MODEL); }
  async onModuleInit() {
    await this.store.collection<AgentRun>('runs').updateMany({ active: true }, { $set: { active: false, status: 'failed' } });
  }
  onModuleDestroy() { for (const controller of this.controllers.values()) controller.abort(); }
  async get(sessionId: string, id: string) {
    const item = await this.store.collection<AgentRun>('runs').findOne({ sessionId, id }, { projection: { _id: 0 } });
    if (!item) throw new DomainError('RESOURCE_NOT_FOUND', 'Rozmowa niedostępna.');
    return item;
  }
  async active(sessionId: string) { return this.store.collection<AgentRun>('runs').findOne({ sessionId, active: true }, { projection: { _id: 0 } }); }
  async start(sessionId: string, message: string, clientRequestId: string) {
    const previous = await this.store.collection<AgentRun>('runs').findOne({ sessionId, clientRequestId }, { projection: { _id: 0 } });
    if (previous) return previous;
    if (!this.available) throw new ServiceUnavailableException('Uzupełnij OPENAI_API_KEY i OPENAI_MODEL w konfiguracji backendu.');
    const item: AgentRun = { id: randomUUID(), sessionId, clientRequestId, active: true, status: 'running', createdAt: new Date() };
    try { await this.store.collection<AgentRun>('runs').insertOne(item); }
    catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await this.store.collection<AgentRun>('runs').findOne({ sessionId, clientRequestId }, { projection: { _id: 0 } });
      if (existing) return existing;
      throw new DomainError('RUN_IN_PROGRESS', 'Poczekaj na zakończenie bieżącego polecenia lub je zatrzymaj.');
    }
    const controller = new AbortController(); this.controllers.set(item.id, controller);
    void this.execute(item, message, controller).catch(() => {}).finally(() => this.controllers.delete(item.id));
    return item;
  }
  async cancel(sessionId: string, id: string) {
    const item = await this.get(sessionId, id);
    if (item.active) this.controllers.get(id)?.abort();
    return { id, requested: item.active };
  }
  async messages(sessionId: string) {
    return this.store.collection<Message & { sessionId: string }>('messages').find({ sessionId }, { projection: { _id: 0, sessionId: 0 } }).sort({ createdAt: -1, id: -1 }).limit(100).toArray().then(items => items.reverse());
  }
  async events(sessionId: string, runId: string, after: number) {
    await this.get(sessionId, runId);
    return this.store.collection<RunEvent & { sessionId: string }>('runEvents').find({ sessionId, runId, seq: { $gt: after } }, { projection: { _id: 0, sessionId: 0 } }).sort({ seq: 1 }).limit(200).toArray();
  }
  private async execute(item: AgentRun, message: string, controller: AbortController) {
    const { id: runId, sessionId } = item;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(settings.AGENT_TIMEOUT_MS)]);
    let seq = 0; let pending = Promise.resolve();
    const emit = (type: string, payload: Record<string, unknown>) => {
      const event: RunEvent & { sessionId: string } = { schemaVersion: 1, sessionId, runId, seq: ++seq, timestamp: new Date().toISOString(), type, payload };
      pending = pending.then(async () => { await this.store.collection<RunEvent & { sessionId: string }>('runEvents').insertOne(event); });
      return pending;
    };
    const messageId = randomUUID();
    try {
      await this.store.collection<Message & { sessionId: string }>('messages').insertOne({ id: randomUUID(), sessionId, role: 'user', content: message, createdAt: new Date().toISOString() });
      const current = await this.workspace.get(sessionId);
      await emit('run.started', { messageId, viewRevision: current.viewRevision });
      const actions = new AgentActions(this.workspace, this.observations, {
        sessionId, runId, expectedRevision: current.viewRevision, signal, lookupGaia: queryGaia,
        onToolCall: call => { void emit('tool.started', { name: call.name }); },
        onToolResult: (name, ok) => { void emit('tool.completed', { name, ok }); },
        onViewUpdate: update => { void emit('view.updated', { state: update.state, changedFields: update.changedFields }); },
      });
      const history = await this.store.collection<{ sessionId: string; items: AgentInputItem[] }>('histories').findOne({ sessionId });
      const output = await run(createSkyAgent(actions, settings.OPENAI_MODEL!, settings.OPENAI_REASONING_EFFORT), [...(history?.items ?? []), { role: 'user', content: message }], { stream: true, maxTurns: settings.AGENT_MAX_TURNS, signal });
      for await (const delta of output.toTextStream({ compatibleWithNodeStreams: true })) {
        signal.throwIfAborted(); await emit('message.delta', { messageId, delta: String(delta) });
      }
      await output.completed; signal.throwIfAborted();
      if (output.error) throw output.error;
      const content = typeof output.finalOutput === 'string' ? output.finalOutput : 'Operacja zakończona.';
      const historyItems = output.history;
      if (Buffer.byteLength(JSON.stringify(historyItems)) > 4 * 1024 * 1024) throw new DomainError('HISTORY_LIMIT', 'Rozmowa osiągnęła limit kontekstu. Rozpocznij nową sesję.');
      const transaction = await this.store.connection.startSession();
      try {
        await transaction.withTransaction(async () => {
          await this.store.collection('histories').updateOne({ sessionId }, { $set: { items: historyItems } }, { upsert: true, session: transaction });
          await this.store.collection<Message & { sessionId: string }>('messages').insertOne({ id: messageId, sessionId, role: 'assistant', content, status: 'completed', createdAt: new Date().toISOString() }, { session: transaction });
        });
      } finally { await transaction.endSession(); }
      await emit('run.completed', { messageId, content });
      await this.store.collection<AgentRun>('runs').updateOne({ id: runId, sessionId }, { $set: { active: false, status: 'completed' } });
    } catch (cause) {
      const cancelled = controller.signal.aborted;
      const content = cancelled ? 'Zatrzymano polecenie. Zatwierdzone wcześniej zmiany pozostają w kokpicie.' : cause instanceof DomainError ? cause.message : signal.aborted ? 'Przekroczono czas odpowiedzi agenta. Spróbuj krótszego polecenia.' : 'Agent nie zakończył polecenia. Sprawdź konfigurację modelu, klucz i dostępność API.';
      try {
        await this.store.collection<Message & { sessionId: string }>('messages').insertOne({ id: messageId, sessionId, role: 'assistant', content, status: cancelled ? 'cancelled' : 'failed', createdAt: new Date().toISOString() });
        await emit(cancelled ? 'run.cancelled' : 'run.failed', { messageId, content });
      } finally { await this.store.collection<AgentRun>('runs').updateOne({ id: runId, sessionId }, { $set: { active: false, status: cancelled ? 'cancelled' : 'failed' } }); }
    }
  }
}
