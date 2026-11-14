import type { Observation } from '@spherex/contracts';

/** Non-overlapping UTC groups with the same maximum span as the RGB time window. */
export function observationTimeline(observations: Observation[], windowHours = 0) {
  const columns = new Map<number, Map<string, Observation[]>>();
  for (const item of observations) {
    const time = Date.parse(item.observedAtUtc);
    if (!Number.isFinite(time) || !item.detector) continue;
    let bands = columns.get(time);
    if (!bands) {
      bands = new Map();
      columns.set(time, bands);
    }
    const images = bands.get(item.detector) ?? [];
    images.push(item);
    bands.set(item.detector, images);
  }
  const ordered = [...columns.entries()].sort(([a], [b]) => a - b);
  const groups: { utc: string; endUtc: string; bands: Map<string, Observation[]> }[] = [];
  const span = Math.max(0, windowHours) * 3600000;
  for (const [time, bands] of ordered) {
    let group = groups.at(-1);
    if (!group || time - Date.parse(group.utc) > span) {
      group = {
        utc: new Date(time).toISOString(),
        endUtc: new Date(time).toISOString(),
        bands: new Map(),
      };
      groups.push(group);
    }
    group.endUtc = new Date(time).toISOString();
    for (const [detector, images] of bands)
      group.bands.set(detector, [...(group.bands.get(detector) ?? []), ...images]);
  }
  return groups;
}

/** One physical square column per exact exposure time inside each time-window group. */
export function observationGridColumns(observations: Observation[], windowHours: number) {
  return observationTimeline(observations, windowHours).flatMap((group, groupIndex) => {
    const exact = observationTimeline([...group.bands.values()].flat());
    return exact.flatMap((column) => {
      const slots = Math.max(...[...column.bands.values()].map((images) => images.length));
      return Array.from({ length: slots }, (_, slot) => ({
        utc: column.utc,
        endUtc: column.endUtc,
        groupIndex,
        key: `${column.utc}:${slot}`,
        bands: new Map(
          [...column.bands].flatMap(([detector, images]) =>
            images[slot] ? [[detector, [images[slot]!]] as const] : [],
          ),
        ),
      }));
    });
  });
}
