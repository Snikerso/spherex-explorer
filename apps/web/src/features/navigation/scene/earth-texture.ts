import * as THREE from 'three';
export function createEarthTexture(land: number[][][]) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#12486b';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#50715c';
  context.strokeStyle = '#92b5a1';
  context.lineWidth = 0.8;
  for (const ring of land) {
    if (!ring.length) continue;
    const points: [number, number][] = [];
    let previous = ((ring[0]![0]! + 180) / 360) * canvas.width;
    for (const [lon, lat] of ring) {
      let x = ((lon! + 180) / 360) * canvas.width;
      while (x - previous > canvas.width / 2) x -= canvas.width;
      while (x - previous < -canvas.width / 2) x += canvas.width;
      points.push([x, ((90 - lat!) / 180) * canvas.height]);
      previous = x;
    }
    for (const shift of [-canvas.width, 0, canvas.width]) {
      context.beginPath();
      points.forEach(([x, y], index) =>
        index ? context.lineTo(x + shift, y) : context.moveTo(x + shift, y),
      );
      context.closePath();
      context.fill();
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
