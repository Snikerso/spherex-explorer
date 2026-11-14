import { expect, it } from 'vitest';
import { BufferGeometry } from 'three';
import { updateOrbitGeometry } from './orbit-geometry';
it('replaces buffers when switching between empty, live, and archived orbit paths', () => {
  const geometry = new BufferGeometry();
  for (const count of [0, 97, 193, 0, 193, 97]) {
    const points = Array.from({ length: count }, (_, index) => ({ x: index, y: 2, z: 3 }));
    updateOrbitGeometry(geometry, points);
    expect(geometry.getAttribute('position').count).toBe(count);
    expect(geometry.drawRange.count).toBe(count);
    if (count) expect(geometry.getAttribute('position').getX(count - 1)).toBe(count - 1);
    else expect(geometry.boundingSphere).toBeNull();
  }
  geometry.dispose();
});
it('updates positions and frustum bounds when only the selected exposure changes', () => {
  const geometry = new BufferGeometry();
  updateOrbitGeometry(geometry, [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  ]);
  updateOrbitGeometry(geometry, [
    { x: 10, y: 0, z: 0 },
    { x: 11, y: 0, z: 0 },
  ]);
  expect(geometry.getAttribute('position').getX(0)).toBe(10);
  expect(geometry.boundingSphere!.center.x).toBeCloseTo(10.5);
  geometry.dispose();
});
