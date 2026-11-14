import * as THREE from 'three';
export function createSpacecraft() {
  const spacecraft = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xd6e1e5,
    metalness: 0.7,
    roughness: 0.35,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 11, 27, 20), bodyMaterial);
  spacecraft.add(body);
  const gold = new THREE.Mesh(
    new THREE.TorusGeometry(10.2, 1.2, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xc9a259, metalness: 0.8, roughness: 0.3 }),
  );
  gold.rotation.x = Math.PI / 2;
  gold.position.y = -11;
  spacecraft.add(gold);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 2, 24),
    new THREE.MeshStandardMaterial({ color: 0x143b54, metalness: 0.8, roughness: 0.18 }),
  );
  lens.position.y = 14;
  spacecraft.add(lens);
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c4478,
    metalness: 0.45,
    roughness: 0.45,
  });
  for (const sign of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(13, 18, 1), panelMaterial);
    panel.position.set(sign * 15, -6, 0);
    spacecraft.add(panel);
    for (let row = 0; row < 4; row++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 1.1), bodyMaterial);
      seam.position.set(sign * 15, -12 + row * 4, 0);
      spacecraft.add(seam);
    }
  }
  return spacecraft;
}
