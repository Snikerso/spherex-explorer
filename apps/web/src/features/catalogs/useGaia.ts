import { useEffect, useState } from 'react';
import { gaiaResultSchema, type GaiaResult, type SkyGrid } from '@spherex/contracts';
import { api } from '../../shared/api/client';
export function useGaia(grid?: SkyGrid) {
  const [enabled, setEnabled] = useState(false);
  const [result, setResult] = useState<{ key: string; data: GaiaResult }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const ra = grid?.raDeg,
    dec = grid?.decDeg;
  // Include margin for high proper motion since Gaia's reference epoch (2016).
  const radius = grid
    ? Math.min(0.5, (Math.hypot(grid.width, grid.height) * grid.pixelScaleDeg) / 2 + 0.05)
    : 0;
  const key = `${ra}/${dec}/${radius}`;
  useEffect(() => {
    if (!enabled || ra === undefined || dec === undefined) return;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    api(
      `/catalogs/gaia?${new URLSearchParams({ ra: String(ra), dec: String(dec), radius: String(radius) })}`,
      undefined,
      'GET',
      controller.signal,
    )
      .then((value) => setResult({ key, data: gaiaResultSchema.parse(value) }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'Gaia unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [enabled, ra, dec, radius, key, retry]);
  return {
    enabled,
    setEnabled,
    data: enabled && result?.key === key ? result.data : undefined,
    busy,
    error,
    retry: () => setRetry((value) => value + 1),
  };
}
export type GaiaController = ReturnType<typeof useGaia>;
