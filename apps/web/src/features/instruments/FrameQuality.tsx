import { useEffect, useState } from 'react';
import type { RenderFrame } from '@spherex/contracts';
import { t } from '../../shared/i18n';
import { api } from '../../shared/api/client';
import type { Quality } from '../../shared/api/analysis-types';
export function FrameQuality({ sequenceId, frame }: { sequenceId: string; frame: RenderFrame }) {
  const [result, setResult] = useState<Quality | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setResult(null);
    setError('');
  }, [sequenceId, frame.id]);
  return (
    <details
      className="frame-quality"
      key={frame.id}
      onToggle={async (event) => {
        if (!event.currentTarget.open || result || busy) return;
        setBusy(true);
        const id = frame.id;
        try {
          const value = await api<{ sources: Quality[] }>(`/sequences/${sequenceId}/analyze`, {
            kind: 'metadata',
            observationIds: [frame.observationId],
            rangeUm: [0.7, 5.1],
          });
          if (id === frame.id) setResult(value.sources[0] ?? null);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : t('Błąd metadanych'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <summary>
        {t('Flagi jakości wycinka · ')}
        {(frame.flaggedFraction * 100).toFixed(1)}
        {t('% wykluczonych pikseli')}
      </summary>
      {busy && <p>{t('Odczyt FLAGS…')}</p>}
      {error && <p>{t(error)}</p>}
      {result?.qualityBits.map((flag) => (
        <p key={flag.bit}>
          Bit {flag.bit} · {flag.name}: {(flag.fraction * 100).toFixed(2)}% · {flag.description}
        </p>
      ))}
      <p>
        {t(
          'SOURCE (bit 21) oznacza znane źródło, nie wadę detektora. Odsetki dotyczą źródłowego wycinka; flagi mogą się nakładać.',
        )}
      </p>
    </details>
  );
}
