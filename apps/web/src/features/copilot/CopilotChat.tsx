import { useEffect, useRef, useState } from 'react';
import { t } from '../../shared/i18n';
import type { ExplorerController } from '../explorer/useExplorer';
import { ChatMessage } from './ChatMessage';
export function CopilotChat({
  explorer,
  onSend,
}: {
  explorer: ExplorerController;
  onSend: (command: string) => Promise<boolean>;
}) {
  const { messages } = explorer;
  const [command, setCommand] = useState('');
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const copilotLauncher = useRef<HTMLButtonElement>(null);
  const copilotInput = useRef<HTMLInputElement>(null);
  const chat = useRef<HTMLDivElement>(null);
  const closeCopilot = () => {
    setCopilotOpen(false);
    copilotLauncher.current?.focus();
  };
  useEffect(() => {
    if (copilotOpen) copilotInput.current?.focus();
  }, [copilotOpen]);
  useEffect(() => {
    chat.current?.scrollTo({ top: chat.current.scrollHeight, behavior: 'instant' });
  }, [messages, copilotOpen]);
  async function send() {
    if (!command.trim() || sending) return;
    setSending(true);
    try {
      if (await onSend(command.trim())) setCommand('');
    } finally {
      setSending(false);
    }
  }
  return (
    <>
      {' '}
      <button
        ref={copilotLauncher}
        className="copilot-launcher"
        aria-label={copilotOpen ? t('Zwiń copilota') : t('Otwórz copilota')}
        aria-expanded={copilotOpen}
        aria-controls="copilot-chat"
        title="Copilot"
        onClick={() => {
          if (copilotOpen) closeCopilot();
          else setCopilotOpen(true);
        }}
      >
        <span aria-hidden="true">✧</span>
        {explorer.runId && <i className="copilot-working" aria-hidden="true" />}
      </button>
      <section
        id="copilot-chat"
        role="dialog"
        aria-modal="false"
        aria-labelledby="copilot-title"
        className="copilot panel copilot-floating"
        hidden={!copilotOpen}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeCopilot();
          }
        }}
      >
        <button className="copilot-close" aria-label={t('Zamknij copilota')} onClick={closeCopilot}>
          ×
        </button>
        <div className="copilot-label">
          <span className="copilot-icon">✧</span>
          <div>
            <h2 id="copilot-title">COPILOT</h2>
            <small>{t('ASYSTENT OBSERWACJI')}</small>
          </div>
          <span className={explorer.capabilities?.agent ? 'online' : 'amber'}>
            {explorer.runId
              ? `PRACUJE · ${explorer.tool || t('ODPOWIEDŹ')}`
              : explorer.capabilities?.agent
                ? t('GOTOWY')
                : t('BRAK KONFIGURACJI')}
          </span>
        </div>
        <div className="conversation" role="log" aria-live="polite" ref={chat}>
          {messages.length ? (
            messages.map((message) => <ChatMessage key={message.id} message={message} />)
          ) : (
            <p>
              {t(
                'Poproś: „Wyszukaj WISE 0855 w DR1 i przygotuj wszystkie obserwacje jednego detektora”. Kontrolki odzwierciedlą działania agenta.',
              )}
            </p>
          )}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <input
            ref={copilotInput}
            aria-label={t('Polecenie dla copilota')}
            placeholder={t('Zapytaj o wybrany obszar nieba…')}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            maxLength={4000}
          />
          {explorer.runId ? (
            <button
              type="button"
              onClick={() => {
                void explorer.cancelRun();
              }}
            >
              Stop ■
            </button>
          ) : (
            <button
              type="submit"
              disabled={!command.trim() || !explorer.capabilities?.agent || sending}
            >
              {t('Wyślij ↗')}
            </button>
          )}
        </form>
      </section>
    </>
  );
}
