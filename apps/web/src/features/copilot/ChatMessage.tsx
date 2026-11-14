import { t } from '../../shared/i18n/index';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '@spherex/contracts';

export function ChatMessage({ message }: { message: Message }) {
  return (
    <article
      className={`chat-message chat-message-${message.role}`}
      aria-label={message.role === 'user' ? t('Twoja wiadomość') : t('Wiadomość copilota')}
    >
      <div className="message-author">{message.role === 'user' ? 'TY' : '✧ COPILOT'}</div>
      <div className="message-content">
        <Markdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            img: ({ alt }) => <span>{alt}</span>,
            table: ({ children }) => (
              <div className="message-table">
                <table>{children}</table>
              </div>
            ),
            h1: ({ children }) => <h3>{children}</h3>,
            h2: ({ children }) => <h3>{children}</h3>,
          }}
        >
          {message.content}
        </Markdown>
      </div>
    </article>
  );
}
