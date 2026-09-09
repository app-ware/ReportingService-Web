import { ServiceUnavailableException } from '@nestjs/common';
import { RenderQueueService } from './render-queue.service';
import { ReportRuntimeConfig, buildReportRuntimeConfig } from 'src/config/report.config';

function makeQueue(overrides: Partial<ReportRuntimeConfig> = {}): RenderQueueService {
  return new RenderQueueService({ ...buildReportRuntimeConfig({}), ...overrides });
}

/** A task that stays pending until the returned `finish` is called. */
function deferred(): { promise: Promise<string>; finish: () => void } {
  let finish!: () => void;
  const promise = new Promise<string>((resolve) => {
    finish = () => resolve('done');
  });
  return { promise, finish };
}

describe('RenderQueueService', () => {
  it('runs a task immediately when a slot is free', async () => {
    const queue = makeQueue({ maxConcurrentRenders: 2 });
    await expect(queue.run(async () => 'rendered')).resolves.toBe('rendered');
    expect(queue.snapshot()).toEqual({ active: 0, queued: 0 });
  });

  it('caps concurrent renders at the configured maximum', async () => {
    const queue = makeQueue({ maxConcurrentRenders: 2, maxQueueDepth: 5 });

    const first = deferred();
    const second = deferred();
    const third = deferred();
    let thirdStarted = false;

    const runs = [
      queue.run(() => first.promise),
      queue.run(() => second.promise),
      queue.run(() => {
        thirdStarted = true;
        return third.promise;
      }),
    ];

    await Promise.resolve();
    expect(queue.snapshot()).toEqual({ active: 2, queued: 1 });
    expect(thirdStarted).toBe(false);

    first.finish();
    // Two microtask turns: one to settle the finished task, one for the waiter to be admitted.
    await new Promise((resolve) => setImmediate(resolve));
    expect(thirdStarted).toBe(true);

    second.finish();
    third.finish();
    await Promise.all(runs);
    expect(queue.snapshot()).toEqual({ active: 0, queued: 0 });
  });

  it('sheds load with 503 once the queue is full', async () => {
    const queue = makeQueue({ maxConcurrentRenders: 1, maxQueueDepth: 1 });

    const running = deferred();
    const queued = deferred();

    const first = queue.run(() => running.promise);
    const second = queue.run(() => queued.promise);
    await Promise.resolve();

    // One active, one waiting — the third has nowhere to go.
    await expect(queue.run(async () => 'third')).rejects.toThrow(ServiceUnavailableException);

    running.finish();
    queued.finish();
    await Promise.all([first, second]);
  });

  it('rejects a waiter that exceeds the queue timeout', async () => {
    const queue = makeQueue({ maxConcurrentRenders: 1, maxQueueDepth: 5, queueTimeoutMs: 500 });

    const running = deferred();
    const first = queue.run(() => running.promise);
    await Promise.resolve();

    await expect(queue.run(async () => 'queued')).rejects.toThrow(ServiceUnavailableException);
    // The timed-out waiter left the queue rather than lingering.
    expect(queue.snapshot().queued).toBe(0);

    running.finish();
    await first;
  });

  it('releases its slot when a task throws, so a failure cannot leak capacity', async () => {
    const queue = makeQueue({ maxConcurrentRenders: 1, maxQueueDepth: 0 });

    await expect(
      queue.run(async () => {
        throw new Error('render blew up');
      }),
    ).rejects.toThrow('render blew up');

    expect(queue.snapshot()).toEqual({ active: 0, queued: 0 });
    // Capacity is genuinely back: the next render is admitted rather than shed.
    await expect(queue.run(async () => 'next')).resolves.toBe('next');
  });

  it('admits waiters in arrival order', async () => {
    const queue = makeQueue({ maxConcurrentRenders: 1, maxQueueDepth: 5 });
    const order: number[] = [];

    const blocker = deferred();
    const first = queue.run(() => blocker.promise);
    await Promise.resolve();

    const waiters = [1, 2, 3].map((n) =>
      queue.run(async () => {
        order.push(n);
      }),
    );

    blocker.finish();
    await Promise.all([first, ...waiters]);

    expect(order).toEqual([1, 2, 3]);
  });
});
