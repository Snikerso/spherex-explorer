/** Bounded work queue. Preserve input order and settle in-flight work before returning. */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  signal: AbortSignal,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new RangeError('Invalid concurrency');
  const results = new Array<R>(items.length);
  let cursor = 0;
  let failed = false;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!failed) {
      signal.throwIfAborted();
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await run(items[index]!, index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  });
  const settled = await Promise.allSettled(workers);
  signal.throwIfAborted();
  for (const result of settled) if (result.status === 'rejected') throw result.reason;
  return results;
}
