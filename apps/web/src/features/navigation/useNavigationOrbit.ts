import { buildOrbitState, type Orbit } from './model/orbit-state';
import { t } from '../../shared/i18n';
import type { RecordedSpacecraft } from './model/recorded-orbit';
import { earthShadow } from './model/earth-light';
import { celestialPositions } from './model/celestial';
import type { FrameSource } from '../sky/components/FrameSources';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { eciToEcf } from 'satellite.js';
import {
  EARTH_RADIUS_KM as R,
  earthIntersection,
  skyDirection,
  type Vector3,
  type RenderFrame,
} from '@spherex/contracts';
import { api } from '../../shared/api/client';

type Land = {
  features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[];
};
const radians = Math.PI / 180;
const add = (p: Vector3, d: Vector3, scale: number): Vector3 => ({
  x: p.x + d.x * scale,
  y: p.y + d.y * scale,
  z: p.z + d.z * scale,
});

export function useNavigationOrbit({
  ra,
  dec,
  fov,
  targetName,
  connected,
  sequenceId,
  frames = [],
  currentFrameId,
  rgbSources = [],
}: {
  rgbSources?: FrameSource[];
  ra: number;
  dec: number;
  fov: number;
  targetName: string;
  connected: boolean;
  sequenceId?: string;
  frames?: RenderFrame[];
  currentFrameId?: string;
}) {
  const [exposureId, setExposureId] = useState('');
  const exposureRef = useRef('');
  const [recorded, setRecorded] = useState<RecordedSpacecraft | null>(null);
  const [readingPosition, setReadingPosition] = useState(false);
  const [webglReady, setWebglReady] = useState(false);
  const [orbit, setOrbit] = useState<Orbit | null>(null);
  const [error, setError] = useState('');
  const [land, setLand] = useState<number[][][]>([]);
  const [clock, setClock] = useState(Date.now());
  const [running, setRunning] = useState(true);
  const [offset, setOffset] = useState(0);
  const [solarView, setSolarView] = useState(true);
  const [camera, setCamera] = useState({ yaw: 0, pitch: 0.25 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  function chooseExposure(frame: RenderFrame) {
    const time = Date.parse(frame.observedAtUtc);
    if (!Number.isFinite(time)) return;
    exposureRef.current = frame.id;
    setExposureId(frame.id);
    setRecorded(null);
    setReadingPosition(true);
    setRunning(false);
    setOffset(0);
    setClock(time);
  }
  useEffect(() => {
    const frame = frames.find((frame) => frame.id === currentFrameId);
    if (frame) chooseExposure(frame);
  }, [sequenceId, currentFrameId]);
  useEffect(() => {
    if (!running) return;
    let previous = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      setClock((value) => value + now - previous);
      previous = now;
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    const load = () => {
      void api<Orbit>('/spacecraft-orbit', undefined, 'GET', controller.signal)
        .then((value) => {
          setOrbit(value);
          setError('');
        })
        .catch((cause) => {
          if (!controller.signal.aborted)
            setError(cause instanceof Error ? cause.message : t('Brak TLE'));
        });
    };
    load();
    const timer = setInterval(load, 2 * 3600000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [connected]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/maps/earth-land.geojson', { signal: controller.signal })
      .then((response) => response.json())
      .then((value: Land) =>
        setLand(
          value.features.flatMap((feature) =>
            feature.geometry.type === 'Polygon'
              ? (feature.geometry.coordinates as number[][][])
              : (feature.geometry.coordinates as number[][][][]).flat(),
          ),
        ),
      )
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const model = useMemo(
    () => buildOrbitState({ clock, offset, orbit, recorded, running }),
    [clock, offset, orbit, recorded, running],
  );
  const celestial = useMemo(() => celestialPositions(model.date), [model.date]);
  const valid =
    Number.isFinite(ra) && Number.isFinite(dec) && ra >= 0 && ra < 360 && dec >= -90 && dec <= 90;
  const direction = eciToEcf(skyDirection(valid ? ra : 0, valid ? dec : 0), model.gmst);
  const hit = valid ? earthIntersection(model.ecf, direction) : null;
  // A north-up solar frame: the Sun stays to the left; satellite motion never moves the camera.
  const sunLongitude = Math.atan2(celestial[0]!.direction.y, celestial[0]!.direction.x);
  const yaw = solarView ? sunLongitude + Math.PI / 2 : camera.yaw,
    pitch = solarView ? 0 : camera.pitch;
  const right = [-Math.sin(yaw), Math.cos(yaw), 0];
  const up = [-Math.sin(pitch) * Math.cos(yaw), -Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch)];
  const forward = [
    Math.cos(pitch) * Math.cos(yaw),
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch),
  ];
  const sunDirection = celestial[0]!.direction;
  const sx = right[0]! * sunDirection.x + right[1]! * sunDirection.y;
  const sy = up[0]! * sunDirection.x + up[1]! * sunDirection.y + up[2]! * sunDirection.z;
  const sz =
    forward[0]! * sunDirection.x + forward[1]! * sunDirection.y + forward[2]! * sunDirection.z;
  const shadow = useMemo(() => {
    if (webglReady) return '';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const image = context.createImageData(256, 256);
    image.data.set(earthShadow(256, { x: sx, y: sy, z: sz }));
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
  }, [sx, sy, sz, webglReady]);
  const radius = 190 * zoom;
  const project = (point: Vector3) => ({
    x: 400 + ((right[0]! * point.x + right[1]! * point.y) / R) * radius,
    y: 275 - ((up[0]! * point.x + up[1]! * point.y + up[2]! * point.z) / R) * radius,
    depth: forward[0]! * point.x + forward[1]! * point.y + forward[2]! * point.z,
  });
  // Project true directions onto a perimeter: distances and disc sizes are intentionally symbolic.
  const skyBodies = celestial.map((body) => {
    const projected = project(body.direction);
    const dx = projected.x - 400,
      dy = projected.y - 275;
    const magnitude = Math.hypot(dx, dy);
    const ux = magnitude > 1e-8 ? dx / magnitude : 1,
      uy = magnitude > 1e-8 ? dy / magnitude : 0;
    const edge = Math.min(330 / Math.max(Math.abs(ux), 1e-8), 205 / Math.max(Math.abs(uy), 1e-8));
    return { ...body, x: 400 + ux * edge, y: 275 + uy * edge, depth: projected.depth };
  });
  const surface = (lon: number, lat: number): Vector3 => ({
    x: R * Math.cos(lat * radians) * Math.cos(lon * radians),
    y: R * Math.cos(lat * radians) * Math.sin(lon * radians),
    z: R * Math.sin(lat * radians),
  });
  const linePath = (points: Vector3[], frontOnly: boolean) => {
    let previous = false;
    return points
      .map((point) => {
        const p = project(point);
        const visible = !frontOnly || p.depth >= 0;
        const command = visible ? `${previous ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}` : '';
        previous = visible;
        return command;
      })
      .join(' ');
  };
  const coast = land
    .map((polygon) =>
      linePath(
        polygon.map((point) => surface(point[0]!, point[1]!)),
        true,
      ),
    )
    .join(' ');
  const graticule = [
    ...Array.from({ length: 12 }, (_, i) =>
      Array.from({ length: 73 }, (_, j) => surface(i * 30 - 180, j * 2.5 - 90)),
    ),
    ...[-60, -30, 0, 30, 60].map((lat) =>
      Array.from({ length: 145 }, (_, i) => surface(i * 2.5 - 180, lat)),
    ),
  ]
    .map((points) => linePath(points, true))
    .join(' ');
  const northPole = project({ x: 0, y: 0, z: R * 1.34 });
  const southPole = project({ x: 0, y: 0, z: -R * 1.34 });
  const sat = project(model.ecf);
  const endpoint = project(add(model.ecf, direction, hit ?? R * 3));
  const delta = { x: endpoint.x - sat.x, y: endpoint.y - sat.y };
  let clip = 1;
  if (delta.x > 0) clip = Math.min(clip, (755 - sat.x) / delta.x);
  if (delta.x < 0) clip = Math.min(clip, (45 - sat.x) / delta.x);
  if (delta.y > 0) clip = Math.min(clip, (475 - sat.y) / delta.y);
  if (delta.y < 0) clip = Math.min(clip, (60 - sat.y) / delta.y);
  const end = { x: sat.x + delta.x * Math.max(0, clip), y: sat.y + delta.y * Math.max(0, clip) };
  const length = Math.hypot(end.x - sat.x, end.y - sat.y);
  const angle = (Math.atan2(delta.y, delta.x) * 180) / Math.PI;
  const spread = Math.min(
    32,
    Math.max(7, length * Math.tan((Math.max(0.001, Math.min(2, fov || 0.1)) * radians) / 2)),
  );
  const perpendicular = {
    x: (-(end.y - sat.y) / Math.max(length, 1)) * spread,
    y: ((end.x - sat.x) / Math.max(length, 1)) * spread,
  };
  const color = hit === null ? '#8fe9e6' : '#ffad83';
  function startDrag(event: PointerEvent<SVGSVGElement>) {
    drag.current = { x: event.clientX, y: event.clientY, yaw, pitch };
    setCamera({ yaw, pitch });
    setSolarView(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    setCamera({
      yaw: drag.current.yaw - (event.clientX - drag.current.x) * 0.007,
      pitch: Math.max(
        -1.4,
        Math.min(1.4, drag.current.pitch + (event.clientY - drag.current.y) * 0.007),
      ),
    });
  }

  function acceptRecordedSpacecraft(value: RecordedSpacecraft | null, id: string) {
    if (exposureRef.current !== id) return;
    setReadingPosition(false);
    setRecorded(value);
    if (value && Number.isFinite(Date.parse(value.observedAtUtc))) {
      setClock(Date.parse(value.observedAtUtc));
      setOffset(0);
      setRunning(false);
    }
  }

  function resetTime() {
    exposureRef.current = '';
    setRecorded(null);
    setReadingPosition(false);
    setClock(Date.now());
    setOffset(0);
    setRunning(true);
  }
  return {
    exposureId,
    chooseExposure,
    acceptRecordedSpacecraft,
    sequenceId,
    frames,
    currentFrameId,
    rgbSources,
    model,
    resetTime,
    readingPosition,
    solarView,
    setSolarView,
    setRunning,
    running,
    setOffset,
    offset,
    zoom,
    setZoom,
    webglReady,
    radius,
    yaw,
    pitch,
    sunDirection,
    direction,
    land,
    hit,
    setWebglReady,
    valid,
    ra,
    dec,
    startDrag,
    moveDrag,
    drag,
    color,
    length,
    linePath,
    graticule,
    coast,
    shadow,
    sat,
    end,
    perpendicular,
    targetName,
    angle,
    northPole,
    southPole,
    skyBodies,
    radians,
    fov,
    orbit,
    error,
  };
}
export type NavigationController = ReturnType<typeof useNavigationOrbit>;
export type NavigationOrbitProps = Parameters<typeof useNavigationOrbit>[0];
