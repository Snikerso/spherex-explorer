import { t } from '../../shared/i18n';
import type { NavigationController } from './useNavigationOrbit';
import { lazy, Suspense } from 'react';
const OrbitScene3D = lazy(() =>
  import('./scene/OrbitScene3D').then((module) => ({ default: module.OrbitScene3D })),
);
export function OrbitVisualization({ controller }: { controller: NavigationController }) {
  const {
    webglReady,
    radius,
    yaw,
    pitch,
    sunDirection,
    model,
    direction,
    land,
    hit,
    setWebglReady,
    valid,
    ra,
    dec,
    startDrag,
    moveDrag,
    drag,
    color,
    length,
    linePath,
    graticule,
    coast,
    shadow,
    sat,
    end,
    perpendicular,
    targetName,
    angle,
    northPole,
    southPole,
    skyBodies,
    solarView,
  } = controller;
  return (
    <>
      <div className={`orbit-scene ${webglReady ? 'orbit-webgl-active' : ''}`}>
        <Suspense fallback={null}>
          <OrbitScene3D
            radius={radius}
            yaw={yaw}
            pitch={pitch}
            sun={sunDirection}
            satellite={model.ecf}
            direction={direction}
            track={model.track}
            land={land}
            hit={hit}
            onReady={setWebglReady}
          />
        </Suspense>
        <svg
          viewBox="0 0 800 540"
          role="img"
          aria-label={t(
            'Ziemia, Słońce, Księżyc i SPHEREx: wybrany kierunek RA {0}°, Dec {1}°. {2}',
            valid ? ra.toFixed(5) : '—',
            valid ? dec.toFixed(5) : '—',
            !valid
              ? t('Brak poprawnych współrzędnych.')
              : hit !== null
                ? t('Kierunek zasłonięty przez Ziemię.')
                : t('Kierunek poza Ziemią.'),
          )}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <defs>
            <mask id="orbit-stars-mask">
              <rect width="800" height="540" fill="white" />
              <circle cx="400" cy="275" r={radius + 2} fill="black" />
            </mask>
            <radialGradient id="orbit-sun">
              <stop offset="0" stopColor="#fffbd0" />
              <stop offset=".6" stopColor="#ffd56b" />
              <stop offset="1" stopColor="#ed8c32" />
            </radialGradient>
            <radialGradient id="orbit-moon">
              <stop offset="0" stopColor="#e3e9ed" />
              <stop offset=".7" stopColor="#9baab8" />
              <stop offset="1" stopColor="#58687b" />
            </radialGradient>
            <radialGradient id="orbit-ocean" cx="32%" cy="25%" r="80%">
              <stop offset="0" stopColor="#245b78" />
              <stop offset=".65" stopColor="#102f49" />
              <stop offset="1" stopColor="#030d1c" />
            </radialGradient>
            <radialGradient id="orbit-atmosphere">
              <stop offset=".85" stopColor="#52c7e5" stopOpacity="0" />
              <stop offset=".95" stopColor="#52c7e5" stopOpacity=".25" />
              <stop offset="1" stopColor="#52c7e5" stopOpacity="0" />
            </radialGradient>
            <clipPath id="orbit-earth-clip">
              <circle cx="400" cy="275" r={radius} />
            </clipPath>
            <marker
              id="orbit-direction-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0 0L10 5L0 10Z" fill={color} />
            </marker>
          </defs>
          <g mask="url(#orbit-stars-mask)">
            {Array.from({ length: 75 }, (_, index) => (
              <circle
                key={index}
                cx={(index * 173.17 + 41) % 800}
                cy={(index * 97.73 + 19) % 540}
                r={index % 5 ? 0.6 : 1}
                fill="#a5ccd7"
                opacity={index % 3 ? 0.25 : 0.6}
              />
            ))}
          </g>
          <path
            className="orbit-svg-geometry"
            d={linePath(model.track, false)}
            fill="none"
            stroke="#4b7a8d"
            strokeWidth="1.4"
            strokeDasharray="5 6"
          />
          <g className="orbit-svg-geometry">
            <circle cx="400" cy="275" r={radius * 1.07} fill="url(#orbit-atmosphere)" />
            <circle cx="400" cy="275" r={radius} fill="#286780" stroke="#39758e" />
            <g clipPath="url(#orbit-earth-clip)">
              <path d={graticule} fill="none" stroke="#81c5d4" strokeWidth=".6" opacity=".2" />
              <path d={coast} fill="none" stroke="#b3e0cc" strokeWidth="1" opacity=".9" />
              <image
                href={shadow}
                x={400 - radius}
                y={275 - radius}
                width={radius * 2}
                height={radius * 2}
              />
            </g>
          </g>
          <path
            className="orbit-svg-geometry"
            d={linePath(model.track, true)}
            fill="none"
            stroke="#64a8c0"
            strokeWidth="1.4"
            strokeDasharray="5 6"
          />
          <text x="400" y={275 + radius * 0.65} textAnchor="middle" className="earth-label">
            {t('ZIEMIA')}
          </text>
          {valid && (
            <g className="orbit-svg-direction">
              <path
                d={`M${sat.x} ${sat.y}L${end.x + perpendicular.x} ${end.y + perpendicular.y}L${end.x - perpendicular.x} ${end.y - perpendicular.y}Z`}
                fill={color}
                opacity=".1"
              />
              <path
                d={`M${sat.x} ${sat.y}L${end.x} ${end.y}`}
                stroke={color}
                strokeWidth="2"
                strokeDasharray={hit !== null ? '5 4' : undefined}
                markerEnd="url(#orbit-direction-arrow)"
              />
              {hit !== null && <circle cx={end.x} cy={end.y} r="6" fill="none" stroke={color} />}
              <text
                x={end.x}
                y={Math.min(500, Math.max(42, end.y - 15))}
                textAnchor={end.x > 620 ? 'end' : end.x < 180 ? 'start' : 'middle'}
                fill={color}
              >
                {hit !== null ? t('ZASŁONIĘTE PRZEZ ZIEMIĘ') : targetName}
              </text>
              {length < 20 && (
                <circle
                  cx={sat.x}
                  cy={sat.y}
                  r="28"
                  fill="none"
                  stroke={color}
                  strokeDasharray="2 4"
                />
              )}
            </g>
          )}
          <g
            className="orbit-svg-spacecraft"
            transform={`translate(${sat.x},${sat.y})`}
            opacity={sat.depth < 0 && Math.hypot(sat.x - 400, sat.y - 275) < radius ? 0.45 : 1}
          >
            <circle r="22" fill="#07151d" stroke="#6ad8dd" strokeOpacity=".4" />
            <g transform={`rotate(${angle})`}>
              <path d="M-13 -12L15 -4L15 4L-13 12Z" fill="#aac2c9" stroke="#e4f3f4" />
              <path d="M-8 -11V11M0 -8V8M8 -6V6" stroke="#466674" strokeWidth="2" />
              <path d="M-19 -5H-13V5H-19Z" fill="#c4a777" />
              <circle cx="16" r="4" fill="#09232e" stroke="#6fe7ee" />
            </g>
            <text x="0" y="-30" textAnchor="middle" fill="#d4f0f1">
              SPHEREx
            </text>
          </g>
          {webglReady && (
            <g className="orbit-axis-labels">
              <text
                x={Math.min(620, Math.max(18, northPole.x + 12))}
                y={Math.max(45, Math.min(480, northPole.y))}
                fill="#ffd28a"
              >
                {t('N · OŚ OBROTU')}
              </text>
              <text
                x={Math.min(620, Math.max(18, northPole.x + 12))}
                y={Math.max(45, Math.min(480, northPole.y)) + 14}
                fill="#a9bdd2"
              >
                {t('obrót z zachodu na wschód')}
              </text>
              <text
                x={Math.min(760, Math.max(18, southPole.x + 12))}
                y={Math.max(45, Math.min(525, southPole.y))}
                fill="#ffd28a"
              >
                S
              </text>
            </g>
          )}
          {webglReady && (
            <text
              x={sat.x}
              y={sat.y - 23}
              textAnchor="middle"
              fill="#d4f0f1"
              opacity={sat.depth < 0 ? 0.4 : 1}
            >
              SPHEREx
              {sat.depth < 0 && Math.hypot(sat.x - 400, sat.y - 275) < radius
                ? t(' · za Ziemią')
                : ''}
            </text>
          )}
          {skyBodies.map((body, index) => (
            <g
              key={body.body}
              className="orbit-celestial"
              transform={`translate(${body.x},${body.y})`}
            >
              <title>
                {body.name} · {Math.round(body.distanceKm).toLocaleString(t('pl-PL'))}
                {t(' km od środka Ziemi · ')}
                {body.depth < 0 ? t('kierunek od obserwatora') : t('kierunek ku obserwatorowi')}
                {t(' · pozycja wskaźnika na obrzeżu, odległość umowna')}
              </title>
              <path
                d={`M${(400 - body.x) * 0.12} ${(275 - body.y) * 0.12}L${(400 - body.x) * 0.35} ${(275 - body.y) * 0.35}`}
                stroke={index ? '#9cb4d3' : '#edbc66'}
                strokeWidth="1"
                strokeDasharray="3 5"
                opacity=".45"
              />
              {index === 0 && (
                <>
                  <circle r="35" fill="#ffc15d" opacity=".06" />
                  <circle r="28" fill="#ffc15d" opacity=".12" />
                  {Array.from({ length: 12 }, (_, ray) => (
                    <path
                      key={ray}
                      d="M25 0H30"
                      transform={`rotate(${ray * 30})`}
                      stroke="#f3b44f"
                      strokeWidth="1.5"
                    />
                  ))}
                </>
              )}
              <circle
                r={index ? 15 : 21}
                fill={index ? 'url(#orbit-moon)' : 'url(#orbit-sun)'}
                stroke={index ? '#c7d5e6' : '#ffdd88'}
              />
              {index === 1 && (
                <g fill="#6e8193" opacity=".6">
                  <circle cx="-5" cy="-4" r="4" />
                  <circle cx="6" cy="4" r="3" />
                  <circle cx="-3" cy="8" r="2" />
                </g>
              )}
              <text y={index ? 30 : 43} textAnchor="middle" fill={index ? '#dce7f3' : '#ffdd91'}>
                {t(body.name.toUpperCase())}
              </text>
              <text y={index ? 43 : 56} textAnchor="middle" fill="#9db2cb" fontSize="9">
                {index
                  ? `${Math.round(body.distanceKm).toLocaleString(t('pl-PL'))} km`
                  : t('{0} mln km', (body.distanceKm / 1e6).toFixed(1))}
              </text>
            </g>
          ))}
          <text x="20" y="20" fill="#8aa9c0" fontSize="9">
            {solarView
              ? t('Widok względem Słońca · północ u góry · satelita porusza się niezależnie')
              : t('Ręczny obrót · przywróć widok względem Słońca przyciskiem powyżej')}
          </text>
        </svg>
      </div>
    </>
  );
}
