// Runs async tasks with a capped number in flight at once. Used to avoid
// firing off one Apify Actor run per URL simultaneously — each run reserves
// its own memory against the account's concurrent-memory limit, so a large
// batch fired all at once can trip that limit even on paid plans.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// A shared concurrency cap that multiple independent async tasks can pull
// permits from, rather than a single flat array processed together. Used so
// stage-1 (direct fetch) and stage-2 (Apify) work can run as one pipeline —
// each URL moves to stage 2 as soon as it needs to, instead of the whole
// batch finishing stage 1 before any stage 2 call starts — while still
// capping how many Apify runs are in flight at once across the whole batch.
export class Semaphore {
  private available: number;
  private queue: (() => void)[] = [];

  constructor(limit: number) {
    this.available = limit;
  }

  private acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  private release() {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.available++;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
