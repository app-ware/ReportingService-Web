import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Browser, BrowserContext, chromium } from 'playwright';
import { REPORT_RUNTIME_CONFIG, ReportRuntimeConfig } from 'src/config/report.config';

/**
 * One Chromium instance for the whole service, with isolated contexts per render.
 *
 * Replaces the four independent `chromium.launch()` calls the report modules used to
 * make: four browsers meant four times the memory and four unbounded render paths, and
 * a crashed browser stayed crashed for the lifetime of the process. Here the browser is
 * launched lazily, shared, and re-launched on disconnect; every render still gets its
 * own `BrowserContext` so nothing (cookies, storage, a hung page) leaks between reports.
 */
@Injectable()
export class BrowserManagerService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  /** In-flight launch, so concurrent first renders share one launch instead of racing. */
  private launching: Promise<Browser> | null = null;
  private shuttingDown = false;

  constructor(
    private readonly logger: PinoLogger,
    @Inject(REPORT_RUNTIME_CONFIG) private readonly config: ReportRuntimeConfig,
  ) {
    this.logger.setContext(BrowserManagerService.name);
  }

  async onModuleInit(): Promise<void> {
    // Warm the browser at boot so the first report does not pay the launch cost, but do
    // not fail startup over it — a failed launch here is retried on the first render.
    try {
      await this.getBrowser();
      this.logger.info('Shared Chromium instance ready.');
    } catch (error) {
      this.logger.warn({ err: error }, 'Chromium warm-up failed; will retry on first render.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    const browser = this.browser;
    this.browser = null;
    this.launching = null;

    if (browser?.isConnected()) {
      try {
        await browser.close();
        this.logger.info('Shared Chromium instance closed.');
      } catch (error) {
        this.logger.warn({ err: error }, 'Failed to close Chromium cleanly.');
      }
    }
  }

  /** True while a usable browser is connected — surfaced for health/telemetry only. */
  isReady(): boolean {
    return !!this.browser?.isConnected();
  }

  async getBrowser(): Promise<Browser> {
    if (this.shuttingDown) {
      throw new ServiceUnavailableException('Reporting service is shutting down.');
    }
    if (this.browser?.isConnected()) {
      return this.browser;
    }
    if (this.launching) {
      return this.launching;
    }

    this.launching = this.launch().finally(() => {
      this.launching = null;
    });

    return this.launching;
  }

  private async launch(): Promise<Browser> {
    // A browser that disconnected (crash, OOM kill) must be dropped before relaunching,
    // otherwise `isConnected()` keeps handing back a dead handle.
    if (this.browser && !this.browser.isConnected()) {
      this.logger.warn('Previous Chromium instance is disconnected; relaunching.');
      this.browser = null;
    }

    const browser = await chromium.launch({
      args: [
        // No untrusted content is loaded, and containers commonly cannot allocate the
        // shared memory Chromium's default /dev/shm sizing expects.
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    browser.on('disconnected', () => {
      if (!this.shuttingDown) {
        this.logger.error('Chromium disconnected unexpectedly; next render will relaunch.');
      }
      if (this.browser === browser) {
        this.browser = null;
      }
    });

    this.browser = browser;
    return browser;
  }

  /**
   * Creates an isolated context for one render.
   *
   * On a context-creation failure the browser handle is dropped and one relaunch is
   * attempted, which is what turns a single crashed Chromium into a slow request rather
   * than a permanently broken service.
   */
  async newContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();

    try {
      return await browser.newContext();
    } catch (error) {
      this.logger.warn({ err: error }, 'Browser context creation failed; relaunching Chromium once.');

      if (this.browser === browser) {
        this.browser = null;
      }
      try {
        await browser.close();
      } catch {
        // Already gone — nothing to clean up.
      }

      const relaunched = await this.getBrowser();
      return relaunched.newContext();
    }
  }

  get renderTimeoutMs(): number {
    return this.config.renderTimeoutMs;
  }
}
