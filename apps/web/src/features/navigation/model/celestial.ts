import { Body, GeoVector, KM_PER_AU, RotateVector, Rotation_EQJ_EQD } from 'astronomy-engine';
import { eciToEcf, gstime } from 'satellite.js';

/** Geocentric ephemerides in the equator of date, rotated into the Earth-fixed scene. */
export function celestialPositions(date: Date) {
  const rotation = Rotation_EQJ_EQD(date);
  const bodies = [Body.Sun, Body.Moon].map((body) => {
    const equatorial = RotateVector(rotation, GeoVector(body, date, true));
    const distanceKm = Math.hypot(equatorial.x, equatorial.y, equatorial.z) * KM_PER_AU;
    const direction = eciToEcf(
      {
        x: (equatorial.x * KM_PER_AU) / distanceKm,
        y: (equatorial.y * KM_PER_AU) / distanceKm,
        z: (equatorial.z * KM_PER_AU) / distanceKm,
      },
      gstime(date),
    );
    return { name: body === Body.Sun ? 'Słońce' : 'Księżyc', body, direction, distanceKm };
  });
  return bodies;
}
