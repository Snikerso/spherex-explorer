import { describe, expect, it } from 'vitest';
import {
  viewPatchSchema,
  viewStateSchema,
  initialView,
  applyViewPatch,
  MAX_SELECTED_OBSERVATIONS,
} from './index';
describe('image selection limit', () => {
  it('accepts 64 images and rejects the 65th in view updates', () => {
    const ids = Array.from({ length: 65 }, (_, i) => `image-${i}`);
    expect(MAX_SELECTED_OBSERVATIONS).toBe(64);
    expect(viewPatchSchema.safeParse({ selectedObservationIds: ids.slice(0, 64) }).success).toBe(
      true,
    );
    expect(viewPatchSchema.safeParse({ selectedObservationIds: ids }).success).toBe(false);
  });
});

it('reads legacy selections over 64 without breaking session initialization or unrelated updates', () => {
  const legacy = {
    ...initialView(),
    selectedObservationIds: Array.from({ length: 259 }, (_, i) => `legacy-${i}`),
  };
  expect(viewStateSchema.parse(legacy).selectedObservationIds).toHaveLength(259);
  expect(applyViewPatch(legacy, { fps: 1 }, 0, 'user').fps).toBe(1);
  expect(
    viewPatchSchema.safeParse({ selectedObservationIds: legacy.selectedObservationIds }).success,
  ).toBe(false);
});
