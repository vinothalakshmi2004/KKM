/**
 * In-process async mutex per key. Calls with the same key run one at a time;
 * different keys run in parallel. Only protects a single Node process.
 */
const tails = new Map();

export async function withKeyedLock(key, fn) {
  const previous = tails.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  tails.set(key, tail);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (tails.get(key) === tail) tails.delete(key);
  }
}
