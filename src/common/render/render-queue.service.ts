import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { REPORT_RUNTIME_CONFIG, ReportRuntimeConfig } from 'src/config/report.config';

export interface QueueSnapshot {
  active: number;
  queued: number;
}

/**
 * A bounded in-process admission queue in front of Chromium.
 *
 * Rendering is the expensive, memory-heavy part of this service, so it is capped rather
 * than left to absorb whatever arrives: at most `maxConcurrentRenders` run at once, at
 * most `maxQueueDepth` wait for a slot, and a waiter that has waited longer than
 * `queueTimeoutMs` is rejected. Shedding load as 503 lets Nursery map it to a clean
 * "busy" response instead of every caller timing out together.
 */
@Injectable()
export class RenderQueueService {
  private active = 0;
  private readonly waiting: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  constructor(@Inject(REPORT_RUNTIME_CONFIG) private readonly config: ReportRuntimeConfig) {}

  snapshot(): QueueSnapshot {
    return { active: this.active, queued: this.waiting.length };
  }

  /**
   * Runs `task` once a render slot is free.
   *
   * The slot is released in `finally`, so a task that throws — including a render
   * timeout — cannot leak capacity.
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.config.maxConcurrentRenders) {
      this.active += 1;
      return;
    }

    if (this.waiting.length >= this.config.maxQueueDepth) {
      throw new ServiceUnavailableException(
        'Reporting service is at capacity. Please retry shortly.',
      );
    }

    await new Promise<void>((resolve, reject) => {
      const entry = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.waiting.indexOf(entry);
          if (index !== -1) {
            this.waiting.splice(index, 1);
          }
          reject(
            new ServiceUnavailableException(
              'Reporting service is at capacity. Please retry shortly.',
            ),
          );
        }, this.config.queueTimeoutMs),
      };

      this.waiting.push(entry);
    });

    this.active += 1;
  }

  private release(): void {
    this.active -= 1;

    const next = this.waiting.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve();
    }
  }
}
