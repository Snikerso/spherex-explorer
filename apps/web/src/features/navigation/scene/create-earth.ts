import * as THREE from 'three';
export function createEarth() {
  const earth = new THREE.Group();
  const globeGeometry = new THREE.SphereGeometry(1, 96, 64);
  globeGeometry.rotateX(Math.PI / 2);
  const globeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.83,
    metalness: 0.08,
  });
  const globe = new THREE.Mesh(globeGeometry, globeMaterial);
  earth.add(globe);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.028, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: { sun: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader:
        'varying vec3 n; varying vec3 p; void main(){vec4 w=modelMatrix*vec4(position,1.0); n=normalize(mat3(modelMatrix)*normal); p=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader:
        'uniform vec3 sun; varying vec3 n; varying vec3 p; void main(){vec3 v=normalize(cameraPosition-p); float rim=pow(1.0-abs(dot(normalize(n),v)),3.0); float day=0.12+0.88*max(0.0,dot(normalize(n),sun)); gl_FragColor=vec4(vec3(0.12,0.5,0.95),rim*day*0.65);}',
    }),
  );
  earth.add(atmosphere);
  const axisMaterial = new THREE.LineDashedMaterial({
    color: 0xffd28a,
    dashSize: 0.045,
    gapSize: 0.025,
    transparent: true,
    opacity: 0.85,
  });
  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -1.3),
      new THREE.Vector3(0, 0, 1.3),
    ]),
    axisMaterial,
  );
  axis.computeLineDistances();
  earth.add(axis);
  const rotationPoints = Array.from({ length: 65 }, (_, index) => {
    const angle = 0.2 + (index / 64) * 4.9;
    return new THREE.Vector3(Math.cos(angle) * 0.23, Math.sin(angle) * 0.23, 1.14);
  });
  const rotationMaterial = new THREE.LineBasicMaterial({ color: 0xffd28a });
  earth.add(
    new THREE.Line(new THREE.BufferGeometry().setFromPoints(rotationPoints), rotationMaterial),
  );
  const rotationArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.035, 0.09, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd28a }),
  );
  rotationArrow.position.copy(rotationPoints[rotationPoints.length - 1]!);
  rotationArrow.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-Math.sin(5.1), Math.cos(5.1), 0),
  );
  earth.add(rotationArrow);
  for (const pole of [-1, 1]) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd28a }),
    );
    marker.position.z = pole * 1.28;
    earth.add(marker);
  }
  return { earth, globeMaterial, atmosphere };
}
