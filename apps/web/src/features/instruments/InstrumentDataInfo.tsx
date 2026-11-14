import type { RenderFrame, Sequence } from '@spherex/contracts';
import { t } from '../../shared/i18n';
import { FrameQuality } from './FrameQuality';
export function InstrumentDataInfo({
  currentFrame,
  sequence,
}: {
  currentFrame?: RenderFrame;
  sequence: Sequence | null;
}) {
  return (
    <section className="instrument-section instrument-details">
      {currentFrame && sequence && (
        <FrameQuality
          key={`${sequence.id}/${currentFrame.id}`}
          sequenceId={sequence.id}
          frame={currentFrame}
        />
      )}
      <details className="quality data-notes">
        <summary>{t('Informacje o danych')}</summary>
        <p>
          {t(
            'Podgląd IRSA, wspólny kontrast asinh. Animacja obejmuje różne długości fali; brak danych jest przezroczysty. Bez dopasowania PSF i fotometrii.',
          )}
        </p>
        {sequence && (
          <p>
            {t('Wspólny kontrast: ')}
            <code>{sequence.stretch?.function}</code>
          </p>
        )}
        <details>
          <summary>
            {t('Szczegóły przygotowania (')}
            {sequence?.warnings?.length ?? 0})
          </summary>
          {[...new Set(sequence?.warnings ?? [])]
            .filter(
              (warning) =>
                !warning.includes('Maska ') &&
                !warning.includes('Filtrowanie długości fali') &&
                !warning.includes('Podgląd wizualny'),
            )
            .map((warning) => (
              <p key={warning}>{t(warning)}</p>
            ))}
        </details>
      </details>
    </section>
  );
}
