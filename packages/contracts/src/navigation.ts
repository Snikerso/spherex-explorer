export type Vector3 = { x: number; y: number; z: number };
export const EARTH_RADIUS_KM = 6378.137;
export function skyDirection(raDeg: number, decDeg: number): Vector3 {
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
  return { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
}
export function earthIntersection(position: Vector3, direction: Vector3, radius = EARTH_RADIUS_KM): number | null {
  const magnitude = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(magnitude) || !magnitude) return null;
  const d = { x: direction.x / magnitude, y: direction.y / magnitude, z: direction.z / magnitude };
  const along = position.x * d.x + position.y * d.y + position.z * d.z;
  const discriminant = along * along - (position.x ** 2 + position.y ** 2 + position.z ** 2 - radius ** 2);
  if (along >= 0 || discriminant < 0) return null;
  const near = -along - Math.sqrt(discriminant);
  return near >= 0 ? near : null;
}
