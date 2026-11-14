import type { Vector3 } from '@spherex/contracts';
export type OrbitSceneProps = {
  radius: number;
  yaw: number;
  pitch: number;
  sun: Vector3;
  satellite: Vector3;
  direction: Vector3;
  track: Vector3[];
  land: number[][][];
  hit: number | null;
  onReady: (ready: boolean) => void;
};
