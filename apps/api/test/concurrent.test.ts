import { expect, it } from 'vitest';
import { mapConcurrent } from '../src/modules/observations/concurrent.js';

it('bounds downloads and preserves manifest order despite completion order', async () => {
  let active = 0, peak = 0;
  const output = await mapConcurrent([30, 5, 15, 1, 3], 2, new AbortController().signal, async delay => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, delay));
    active--;
    return delay;
  });
  expect(peak).toBe(2);
  expect(active).toBe(0);
  expect(output).toEqual([30, 5, 15, 1, 3]);
});

it('stops scheduling after cancellation and waits for active work to finish', async () => {
  const controller = new AbortController();
  const started: number[] = [], finished: number[] = [];
  await expect(mapConcurrent([0, 1, 2, 3], 2, controller.signal, async value => {
    started.push(value);
    await new Promise(resolve => setTimeout(resolve, 5));
    controller.abort();
    finished.push(value);
  })).rejects.toThrow();
  expect(started).toEqual([0, 1]);
  expect(finished).toEqual([0, 1]);
});
