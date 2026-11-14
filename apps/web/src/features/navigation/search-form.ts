import type { SearchInput } from '@spherex/contracts';
export const defaultInput: SearchInput = {
  raDeg: 133.79512917,
  decDeg: -7.24514722,
  fovDeg: 0.1,
  fromUtc: null,
  toUtc: null,
  release: 'dr1',
};
export function formFrom(input: SearchInput) {
  return {
    ra: String(input.raDeg),
    dec: String(input.decDeg),
    fov: String(input.fovDeg),
    from: input.fromUtc?.slice(0, 10) ?? '',
    to: input.toUtc?.slice(0, 10) ?? '',
    release: input.release,
  };
}

export type SearchDraft = ReturnType<typeof formFrom>;
