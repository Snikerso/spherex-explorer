import * as THREE from 'three';
import { EARTH_RADIUS_KM as earthRadius, type Vector3 } from '@spherex/contracts';
import { updateOrbitGeometry } from './orbit-geometry';
import { createEarthTexture } from './earth-texture';
import { createEarth } from './create-earth';
import { createSpacecraft } from './create-spacecraft';
import type { OrbitSceneProps } from './types';
const vector = (point: Vector3) => new THREE.Vector3(point.x, point.y, point.z);
export function createOrbitScene(container: HTMLDivElement, onContextLost: () => void) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-400, 400, 270, -270, 0.1, 10000);
  const world = new THREE.Group();
  scene.add(world);
  const { earth, globeMaterial, atmosphere } = createEarth();
  world.add(earth);
  const ambient = new THREE.AmbientLight(0x829dc1, 0.13);
  scene.add(ambient);
  const sunlight = new THREE.DirectionalLight(0xfff4dc, 3.2);
  scene.add(sunlight);
  const orbitGeometry = new THREE.BufferGeometry();
  const orbitLine = new THREE.Line(
    orbitGeometry,
    new THREE.LineDashedMaterial({
      color: 0x70b8e0,
      dashSize: 6,
      gapSize: 5,
      transparent: true,
      opacity: 0.75,
    }),
  );
  world.add(orbitLine);
  const orbitTube = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: 0x78bfe4,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  world.add(orbitTube);
  let previousTrack: Vector3[] | undefined;
  const spacecraft = createSpacecraft();
  world.add(spacecraft);
  const directionGeometry = new THREE.BufferGeometry();
  const sight = new THREE.Line(
    directionGeometry,
    new THREE.LineBasicMaterial({ color: 0x8fe9e6, transparent: true, opacity: 0.8 }),
  );
  world.add(sight);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(20, 150, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x8fe9e6,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  world.add(cone);
  let texture: THREE.CanvasTexture | undefined, previousLand: number[][][] | undefined;
  const render = (value: OrbitSceneProps) => {
    const { yaw, pitch, radius } = value;
    if (previousLand !== value.land) {
      texture?.dispose();
      texture = createEarthTexture(value.land);
      globeMaterial.map = texture;
      globeMaterial.needsUpdate = true;
      previousLand = value.land;
    }
    world.scale.setScalar(radius);
    const up = new THREE.Vector3(
      -Math.sin(pitch) * Math.cos(yaw),
      -Math.sin(pitch) * Math.sin(yaw),
      Math.cos(pitch),
    );
    const forward = new THREE.Vector3(
      Math.cos(pitch) * Math.cos(yaw),
      Math.cos(pitch) * Math.sin(yaw),
      Math.sin(pitch),
    );
    const target = up.clone().multiplyScalar(5);
    camera.position.copy(forward.multiplyScalar(2000).add(target));
    camera.up.copy(up);
    camera.lookAt(target);
    sunlight.position.copy(vector(value.sun).multiplyScalar(2000));
    (atmosphere.material as THREE.ShaderMaterial).uniforms.sun!.value.copy(vector(value.sun));
    const position = vector(value.satellite).divideScalar(earthRadius);
    const direction = vector(value.direction).normalize();
    spacecraft.position.copy(position);
    spacecraft.scale.setScalar(1 / 190);
    spacecraft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    updateOrbitGeometry(
      orbitGeometry,
      value.track.map((point) => vector(point).divideScalar(earthRadius)),
    );
    (orbitLine.material as THREE.LineDashedMaterial).dashSize = 0.035;
    (orbitLine.material as THREE.LineDashedMaterial).gapSize = 0.025;
    orbitLine.computeLineDistances();
    if (previousTrack !== value.track) {
      previousTrack = value.track;
      orbitTube.geometry.dispose();
      orbitTube.visible = value.track.length > 2;
      orbitTube.geometry =
        value.track.length > 2
          ? new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3(
                value.track.map((point) => vector(point).divideScalar(earthRadius)),
              ),
              Math.max(96, value.track.length - 1),
              0.0035,
              6,
              false,
            )
          : new THREE.BufferGeometry();
    }
    const length = value.hit === null ? 1.1 : Math.max(0, value.hit / earthRadius);
    directionGeometry.setFromPoints([
      position,
      position.clone().addScaledVector(direction, length),
    ]);
    (sight.material as THREE.LineBasicMaterial).color.set(value.hit === null ? 0x8fe9e6 : 0xffad83);
    cone.scale.set(0.0015, length / 150, 0.0015);
    cone.position.copy(position).addScaledVector(direction, length / 2);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
    // Cone apex is at the telescope; both beam and orbit obey globe depth occlusion.
    const width = container.clientWidth,
      height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const viewWidth = Math.max(800, (540 * width) / height),
      viewHeight = Math.max(540, (800 * height) / width);
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  const lost = (event: Event) => {
    event.preventDefault();
    onContextLost();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  return {
    render,
    dispose() {
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = mesh.material
          ? Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          : [];
        materials.forEach((material) => material.dispose());
      });
      texture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
