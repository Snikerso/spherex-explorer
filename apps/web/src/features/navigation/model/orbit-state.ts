import { eciToEcf, eciToGeodetic, gstime, propagate, twoline2satrec } from 'satellite.js';
import { EARTH_RADIUS_KM as R, type Vector3 } from '@spherex/contracts';
import { recordedEarthPosition, recordedOrbit, type RecordedSpacecraft } from './recorded-orbit';
export type Orbit = {
  line1: string;
  line2: string;
  epochUtc: string;
  fetchedAt: string;
  stale: boolean;
  sourceUrl: string;
};
const radians = Math.PI / 180;
function nominal(date: Date) {
  const phase = (date.getTime() / 1000 / (98 * 60)) * Math.PI * 2;
  return {
    x: (R + 650) * Math.cos(phase),
    y: (R + 650) * Math.sin(phase) * Math.cos(97.95 * radians),
    z: (R + 650) * Math.sin(phase) * Math.sin(97.95 * radians),
  };
}
export function buildOrbitState({
  clock,
  offset,
  orbit,
  recorded,
  running,
}: {
  clock: number;
  offset: number;
  orbit: Orbit | null;
  recorded: RecordedSpacecraft | null;
  running: boolean;
}) {
  const date = new Date(clock + offset * 60000);
  const gmst = gstime(date);
  const fitted = recorded ? recordedOrbit(recorded, date) : null;
  if (recorded && (fitted || (!running && offset === 0))) {
    const ecf = fitted?.position ?? recordedEarthPosition(recorded);
    return {
      date,
      gmst,
      ecf,
      geographic: {
        latitude: Math.atan2(ecf.z, Math.hypot(ecf.x, ecf.y)),
        longitude: Math.atan2(ecf.y, ecf.x),
        height: Math.hypot(ecf.x, ecf.y, ecf.z) - R,
      },
      real: true,
      recorded: true,
      estimated: fitted?.estimated ?? false,
      track: fitted?.track ?? ([] as Vector3[]),
      period: fitted?.periodMinutes ?? null,
      speed: fitted?.speedKmS ?? recorded.speedKmS,
    };
  }
  const fresh = orbit && Math.abs(date.getTime() - Date.parse(orbit.epochUtc)) <= 7 * 86400000;
  const satrec = fresh ? twoline2satrec(orbit.line1, orbit.line2) : null;
  const state = satrec ? propagate(satrec, date) : null;
  const real = Boolean(state?.position && !satrec?.error);
  const position = state?.position && real ? state.position : nominal(date);
  const ecf = eciToEcf(position, gmst);
  const geographic = eciToGeodetic(position, gmst);
  const period = satrec && real ? (2 * Math.PI) / satrec.no : 98;
  const track = Array.from({ length: 97 }, (_, index) => {
    const time = new Date(date.getTime() + (index / 96 - 0.5) * period * 60000);
    const sample = real && satrec ? propagate(satrec, time)?.position : nominal(time);
    return sample ? eciToEcf(sample, gmst) : null;
  }).filter((point): point is Vector3 => Boolean(point));
  const speed =
    state?.velocity && real
      ? Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z)
      : (2 * Math.PI * (R + 650)) / (98 * 60);
  return {
    date,
    gmst,
    ecf,
    geographic,
    real,
    recorded: false,
    estimated: false,
    track,
    period,
    speed,
  };
}
export type OrbitState = ReturnType<typeof buildOrbitState>;
