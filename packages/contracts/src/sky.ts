export interface SkyGrid { width: number; height: number; raDeg: number; decDeg: number; pixelScaleDeg: number; }
const radians = Math.PI / 180;
/** PNG has north at the top, east at the left. Pixel centres follow Astropy origin=0. */
export function pixelToSky(grid: SkyGrid, x: number, y: number) {
  const xi = -(x - (grid.width - 1) / 2) * grid.pixelScaleDeg * radians;
  const eta = ((grid.height - 1) / 2 - y) * grid.pixelScaleDeg * radians;
  const dec0 = grid.decDeg * radians;
  const denominator = Math.cos(dec0) - eta * Math.sin(dec0);
  return {
    raDeg: ((grid.raDeg + Math.atan2(xi, denominator) / radians) % 360 + 360) % 360,
    decDeg: Math.atan2(Math.sin(dec0) + eta * Math.cos(dec0), Math.hypot(denominator, xi)) / radians,
  };
}
export function skyToPixel(grid: SkyGrid, point: { raDeg: number; decDeg: number }) {
  const ra = (point.raDeg - grid.raDeg) * radians;
  const dec = point.decDeg * radians; const dec0 = grid.decDeg * radians;
  const cosc = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(ra);
  if (cosc <= 0) return null;
  const xi = Math.cos(dec) * Math.sin(ra) / cosc;
  const eta = (Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(ra)) / cosc;
  return { x: (grid.width - 1) / 2 - xi / radians / grid.pixelScaleDeg, y: (grid.height - 1) / 2 - eta / radians / grid.pixelScaleDeg };
}
