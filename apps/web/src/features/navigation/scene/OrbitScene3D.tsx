import { useEffect, useRef } from 'react';
import { createOrbitScene } from './create-scene';
import type { OrbitSceneProps } from './types';
export type { OrbitSceneProps } from './types';

/** React owns mounting; the renderer adapter owns GPU resources and drawing. */
export function OrbitScene3D(props: OrbitSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const update = useRef<((props: OrbitSceneProps) => void) | null>(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const instance = createOrbitScene(host.current!, () => latest.current.onReady(false));
    if (!instance) {
      latest.current.onReady(false);
      return;
    }
    update.current = instance.render;
    const resize = new ResizeObserver(() => instance.render(latest.current));
    resize.observe(host.current!);
    instance.render(latest.current);
    latest.current.onReady(true);
    return () => {
      resize.disconnect();
      update.current = null;
      instance.dispose();
    };
  }, []);
  useEffect(() => {
    update.current?.(props);
  });
  return <div className="orbit-webgl" ref={host} aria-hidden="true" />;
}
