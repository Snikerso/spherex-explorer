import { MakeTime, RotateVector, Rotation_EQJ_EQD, Vector } from 'astronomy-engine';
import { eciToEcf, gstime } from 'satellite.js';
import { EARTH_RADIUS_KM, type Vector3 } from '@spherex/contracts';
export type RecordedSpacecraft = {
  latitudeDeg: number;
  longitudeDeg: number;
  radiusKm: number;
  speedKmS: number | null;
  observedAtUtc: string;
  method: string;
  inertialPositionKm?: Vector3;
  inertialVelocityKmS?: Vector3 | null;
};
export function recordedEarthPosition(recorded: RecordedSpacecraft): Vector3 {
  const lat = (recorded.latitudeDeg * Math.PI) / 180,
    lon = (recorded.longitudeDeg * Math.PI) / 180;
  return {
    x: recorded.radiusKm * Math.cos(lat) * Math.cos(lon),
    y: recorded.radiusKm * Math.cos(lat) * Math.sin(lon),
    z: recorded.radiusKm * Math.sin(lat),
  };
}

const mu = 398600.4418;
const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (v: Vector3, s: number): Vector3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const sum = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const cross = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (v: Vector3) => Math.hypot(v.x, v.y, v.z);

/** Osculating two-body ellipse from one exposure, not a precise historical ephemeris.
 * All track points share the displayed Earth's orientation: this is an orbit in space,
 * not a ground track sampled in different rotating coordinate frames.
 */
export function recordedOrbit(recorded: RecordedSpacecraft, date: Date) {
  const r = recorded.inertialPositionKm,
    v = recorded.inertialVelocityKmS;
  if (!r || !v || ![r.x, r.y, r.z, v.x, v.y, v.z].every(Number.isFinite)) return null;
  const radius = norm(r),
    h = cross(r, v),
    momentum = norm(h);
  const a = 1 / (2 / radius - dot(v, v) / mu);
  const eccentricity = sum(scale(cross(v, h), 1 / mu), scale(r, -1 / radius));
  const e = norm(eccentricity);
  if (
    !Number.isFinite(a) ||
    momentum < 1 ||
    e >= 0.2 ||
    a * (1 - e) < EARTH_RADIUS_KM + 80 ||
    a > 15000
  )
    return null;
  const p = e > 1e-8 ? scale(eccentricity, 1 / e) : scale(r, 1 / radius);
  const q = cross(scale(h, 1 / momentum), p);
  const beta = Math.sqrt(1 - e * e);
  const E0 = Math.atan2(dot(r, q) / (a * beta), dot(r, p) / a + e);
  const M0 = E0 - e * Math.sin(E0),
    n = Math.sqrt(mu / a ** 3),
    periodSeconds = (2 * Math.PI) / n;
  const epoch = new Date(recorded.observedAtUtc),
    elapsed = (date.getTime() - epoch.getTime()) / 1000;
  if (!Number.isFinite(elapsed) || Math.abs(elapsed) > 3 * 3600) return null;
  const rotation = Rotation_EQJ_EQD(epoch),
    time = MakeTime(epoch),
    gmst = gstime(epoch);
  const toReference = (point: Vector3) => {
    const eq = RotateVector(rotation, new Vector(point.x, point.y, point.z, time));
    return eciToEcf(eq, gmst);
  };
  // Align the celestial-axis approximation with the FITS ground-track anchor used by
  // the spherical globe. Apply the same rigid rotation to the complete orbital plane.
  const from = scale(toReference(r), 1 / radius),
    anchor = recordedEarthPosition(recorded);
  const target = scale(anchor, 1 / norm(anchor)),
    k = cross(from, target),
    cosine = dot(from, target);
  if (cosine < -0.99) return null;
  const earthAngle = gstime(date) - gmst;
  const toScene = (point: Vector3) => {
    const base = toReference(point),
      first = cross(k, base);
    const aligned = sum(sum(base, first), scale(cross(k, first), 1 / (1 + cosine)));
    return {
      x: aligned.x * Math.cos(earthAngle) + aligned.y * Math.sin(earthAngle),
      y: -aligned.x * Math.sin(earthAngle) + aligned.y * Math.cos(earthAngle),
      z: aligned.z,
    };
  };
  const sample = (seconds: number) => {
    const M = M0 + n * seconds;
    let E = M;
    for (let i = 0; i < 10; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return toScene(sum(scale(p, a * (Math.cos(E) - e)), scale(q, a * beta * Math.sin(E))));
  };
  const position = sample(elapsed);
  const track = Array.from({ length: 193 }, (_, index) =>
    sample(elapsed + (index / 192 - 0.5) * periodSeconds),
  );
  return {
    position,
    track,
    periodMinutes: periodSeconds / 60,
    speedKmS: Math.sqrt(mu * (2 / norm(position) - 1 / a)),
    estimated: Math.abs(elapsed) > 0.001,
  };
}
