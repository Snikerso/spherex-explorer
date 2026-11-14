import type { Observation, RenderFrame } from '@spherex/contracts';
import { t } from '../../shared/i18n';
import { formatDate } from '../../shared/lib/date';
export function InstrumentTelemetry({
  currentFrame,
  observation,
}: {
  currentFrame?: RenderFrame;
  observation?: Observation;
}) {
  return (
    <section className="instrument-section">
      <h3>{t('TELEMETRIA DANYCH')}</h3>
      <dl className="instrument-metrics">
        <div className="metric-feature">
          <dt>{t('Detektor')}</dt>
          <dd>
            {(currentFrame?.detector ?? observation?.detector)?.replace('SPHEREx-', '') ?? '—'}
          </dd>
        </div>
        <div className="metric-feature">
          <dt>{t('Długość fali')}</dt>
          <dd>
            {currentFrame ? currentFrame.wavelengthUm.toFixed(3) : '—'}
            <small> µm</small>
          </dd>
        </div>
        <div className="metric-wide">
          <dt>{t('Data / UTC')}</dt>
          <dd>
            <time dateTime={currentFrame?.observedAtUtc}>
              {formatDate(currentFrame?.observedAtUtc)}
            </time>
          </dd>
        </div>
        <div className="metric-wide metric-coverage">
          <dt>{t('Pokrycie obrazu')}</dt>
          <dd>
            {currentFrame
              ? `${((currentFrame.unmaskedCoverage ?? currentFrame.coverage) * 100).toFixed(1)}%`
              : '—'}
          </dd>
          <meter
            aria-label={t('Pokrycie obrazu')}
            min="0"
            max="1"
            value={currentFrame?.unmaskedCoverage ?? currentFrame?.coverage ?? 0}
          />
        </div>
        <div className="metric-wide metric-source">
          <dt>{t('Źródło')}</dt>
          <dd>IRSA / SPHEREx</dd>
        </div>
      </dl>
    </section>
  );
}
