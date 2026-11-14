import { t } from '../../shared/i18n/index';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RenderFrame } from '@spherex/contracts';
import type { RecordedSpacecraft } from './model/recorded-orbit';
import type { FrameSource } from '../sky/components/FrameSources';
import { BandAvailability } from '../sky/components/BandAvailability';
import { api } from '../../shared/api/client';
type Pointing = {
  raDeg: number;
  decDeg: number;
  positiveXAngleDeg: number;
  positiveYAngleDeg: number;
  observedAtUtc: string;
  timeSource: string;
  coordinateSystem: string;
};
export function RecordedPointing({
  sequenceId,
  frames,
  currentFrameId,
  selectedFrameId,
  rgbSources = [],
  onSelectExposure,
  onRecordedSpacecraft,
}: {
  selectedFrameId?: string;
  onSelectExposure?: (frame: RenderFrame) => void;
  onRecordedSpacecraft?: (value: RecordedSpacecraft | null, id: string) => void;
  rgbSources?: FrameSource[];
  sequenceId?: string;
  frames: RenderFrame[];
  currentFrameId?: string;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [selectedEmpty, setSelectedEmpty] = useState<{ time: string; detector: string } | null>(
    null,
  );
  const metadataCache = useRef(
    new Map<
      string,
      { recordedPointing?: Pointing | null; recordedSpacecraft?: RecordedSpacecraft | null }
    >(),
  );
  const onLoaded = useRef(onRecordedSpacecraft);
  onLoaded.current = onRecordedSpacecraft;
  const selected =
    frames.find((frame) => frame.id === selectedFrameId) ??
    frames.find((frame) => frame.id === selectedId) ??
    frames.find((frame) => frame.id === currentFrameId) ??
    frames[0];
  const exposures = useMemo(
    () => [
      ...new Map(
        [...frames]
          .sort((a, b) => Date.parse(a.observedAtUtc) - Date.parse(b.observedAtUtc))
          .map((frame) => [frame.observedAtUtc, frame]),
      ).values(),
    ],
    [frames],
  );
  const [pointing, setPointing] = useState<Pointing | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPointing(null);
    setError('');
    if (!sequenceId || !selected) return;
    const cacheKey = `${sequenceId}/${selected.id}/orbit-v2`;
    const cached = metadataCache.current.get(cacheKey);
    if (cached) {
      setPointing(cached.recordedPointing ?? null);
      setBusy(false);
      onLoaded.current?.(cached.recordedSpacecraft ?? null, selected.id);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    api<{
      sources: {
        recordedPointing?: Pointing | null;
        recordedSpacecraft?: RecordedSpacecraft | null;
      }[];
    }>(
      `/sequences/${sequenceId}/analyze`,
      { kind: 'metadata', observationIds: [selected.observationId], rangeUm: [0.7, 5.1] },
      'POST',
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.sources[0]) metadataCache.current.set(cacheKey, result.sources[0]);
        onLoaded.current?.(result.sources[0]?.recordedSpacecraft ?? null, selected.id);
        const value = result.sources[0]?.recordedPointing;
        if (value) setPointing(value);
        else setError(t('Brak poprawnej orientacji WCS w tej ekspozycji.'));
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : t('Błąd odczytu FITS'));
          onLoaded.current?.(null, selected.id);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [sequenceId, selected?.id, selected?.observationId]);
  const arrow = (angle: number) => ({
    x: 48 + 30 * Math.sin((angle * Math.PI) / 180),
    y: 48 - 30 * Math.cos((angle * Math.PI) / 180),
  });
  return (
    <details className="recorded-pointing" open>
      <summary>{t('Orientacja z danych pomiarowych · pole detektora (archiwum)')}</summary>
      <p className="attitude-status">
        {t('Orientacja całego satelity na żywo: brak podłączonej telemetrii ADCS.')}
      </p>
      {selected ? (
        <>
          <BandAvailability
            exact
            allFrames={frames}
            frames={exposures}
            bands={[]}
            currentIndex={exposures.findIndex(
              (frame) => frame.observedAtUtc === selected.observedAtUtc,
            )}
            epochHours={0}
            currentSources={rgbSources}
            selectedSourceId={selected.id}
            selectedEmpty={selectedEmpty}
            onSelectEmpty={(frame, detector) => {
              setSelectedEmpty({ time: frame.observedAtUtc, detector });
              setSelectedId(frame.id);
              onSelectExposure?.(frame);
              const cached = metadataCache.current.get(`${sequenceId}/${frame.id}/orbit-v2`);
              if (cached) onLoaded.current?.(cached.recordedSpacecraft ?? null, frame.id);
            }}
            onSelectSource={(id) => {
              setSelectedEmpty(null);
              setSelectedId(id);
              const frame = frames.find((frame) => frame.id === id);
              if (frame) {
                onSelectExposure?.(frame);
                const cached = metadataCache.current.get(`${sequenceId}/${id}/orbit-v2`);
                if (cached) onLoaded.current?.(cached.recordedSpacecraft ?? null, id);
              }
            }}
            onSelectFrame={() => {}}
            onActivate={() => {}}
          />
          <p className="selected-exposure">
            {selectedEmpty && (
              <span>
                {selectedEmpty.detector.replace('SPHEREx-', '')}
                {t(' · brak ekspozycji. Pozycja satelity z pasma dostępnego w tej samej kolumnie.')}
                <br />
              </span>
            )}
            {t('Wybrana ekspozycja: ')}
            <b>{selected.detector?.replace('SPHEREx-', '')}</b> ·{' '}
            {selected.observedAtUtc.replace('T', ' ').replace('Z', '')} UTC
          </p>
          {busy && <p role="status">{t('Odczyt zarejestrowanej orientacji pola…')}</p>}
          {error && <p role="alert">{t(error)}</p>}
          {pointing && !selectedEmpty && (
            <div className="recorded-pointing-data">
              <svg
                viewBox="0 0 96 96"
                role="img"
                aria-label={t(
                  'Orientacja osi detektora: +Y {0} stopnia na wschód od północy',
                  pointing.positiveYAngleDeg.toFixed(2),
                )}
              >
                <circle cx="48" cy="48" r="34" fill="none" stroke="#39515f" />
                <path d="M48 10V86M10 48H86" stroke="#39515f" strokeDasharray="2 3" />
                <text x="48" y="8" textAnchor="middle">
                  N
                </text>
                <text x="88" y="51">
                  E
                </text>
                {[
                  { angle: pointing.positiveXAngleDeg, label: '+X', color: '#e7be7d' },
                  { angle: pointing.positiveYAngleDeg, label: '+Y', color: '#8fe9e6' },
                ].map((axis) => {
                  const end = arrow(axis.angle);
                  return (
                    <g key={axis.label}>
                      <path d={`M48 48L${end.x} ${end.y}`} stroke={axis.color} strokeWidth="2" />
                      <circle cx={end.x} cy={end.y} r="2" fill={axis.color} />
                      <text x={end.x} y={end.y - 6} textAnchor="middle" fill={axis.color}>
                        {axis.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div>
                <b>
                  {selected.detector?.replace('SPHEREx-', '')}
                  {t(' · punkt odniesienia WCS')}
                </b>
                <p>
                  RA {pointing.raDeg.toFixed(6)}° · DEC {pointing.decDeg.toFixed(6)}°
                </p>
                <p>
                  {t('Obrót osi +Y: ')}
                  {pointing.positiveYAngleDeg.toFixed(3)}
                  {t('° E od N')}
                </p>
                <time dateTime={pointing.observedAtUtc}>
                  {pointing.observedAtUtc} · {pointing.timeSource}
                </time>
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                  {t('Źródłowy FITS ↗')}
                </a>
              </div>
            </div>
          )}
        </>
      ) : (
        <p>{t('Przygotuj obserwacje, aby odczytać zarejestrowaną orientację pola z FITS.')}</p>
      )}
      <p className="help">
        {t(
          'To astrometrycznie wyznaczony kierunek i obrót pola detektora podczas tej ekspozycji. Nie wyznacza orientacji korpusu ani wspólnej osi optycznej teleskopu. Kliknięcie ekspozycji ustawia czas globu i pozycję satelity z jej FITS. Strzałka pozostaje podglądem wybranego celu; położenie z FITS wykorzystuje kulisty model Ziemi.',
        )}
      </p>
    </details>
  );
}
