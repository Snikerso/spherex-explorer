/** Solar illumination of a surface normal: twilight blends across the geometric terminator. */
export function shadowAlpha(cosine: number) {
  const transition = Math.max(0, Math.min(1, (cosine + 0.06) / 0.12));
  const daylight = transition * transition * (3 - 2 * transition);
  return 0.9 * (1 - daylight) + 0.28 * (1 - Math.max(0, cosine)) * daylight;
}

/** Orthographic visible hemisphere; x right, y up, z towards the viewer. */
export function earthShadow(size: number, sun: { x: number; y: number; z: number }) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) * 2) / size - 1,
        ny = 1 - ((y + 0.5) * 2) / size;
      const square = nx * nx + ny * ny;
      if (square > 1) continue;
      const cosine = nx * sun.x + ny * sun.y + Math.sqrt(1 - square) * sun.z;
      pixels[(y * size + x) * 4 + 3] = Math.round(shadowAlpha(cosine) * 255);
    }
  return pixels;
}
