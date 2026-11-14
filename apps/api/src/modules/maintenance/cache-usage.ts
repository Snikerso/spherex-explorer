// The API owns a local cache: maintenance never overlaps a producer/worker.
let users = 0;
let maintenance: Promise<unknown> | undefined;
export async function useCache<T>(work: () => Promise<T>): Promise<T> {
  while (maintenance) await maintenance.catch(() => {});
  users++;
  try {
    return await work();
  } finally {
    users--;
  }
}
export async function maintainCache<T>(work: () => Promise<T>): Promise<T | undefined> {
  if (users || maintenance) return;
  // Defer work until the gate has been published to new cache users.
  const task = Promise.resolve().then(work);
  maintenance = task;
  try {
    return await task;
  } finally {
    maintenance = undefined;
  }
}
