import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { Vector3 } from '@spherex/contracts';

/** setFromPoints cannot resize an existing position buffer when the source changes. */
export function updateOrbitGeometry(geometry: BufferGeometry, points: Vector3[]) {
  let positions = geometry.getAttribute('position');
  if (!positions || positions.count !== points.length) {
    positions = new Float32BufferAttribute(
      points.flatMap((point) => [point.x, point.y, point.z]),
      3,
    );
    geometry.setAttribute('position', positions);
  } else {
    points.forEach((point, index) => positions.setXYZ(index, point.x, point.y, point.z));
    positions.needsUpdate = true;
  }
  geometry.setDrawRange(0, points.length);
  if (points.length) geometry.computeBoundingSphere();
  else geometry.boundingSphere = null;
}
