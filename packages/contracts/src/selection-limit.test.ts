import { describe, expect, it } from 'vitest';
import { viewPatchSchema, MAX_SELECTED_OBSERVATIONS } from './index';
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
