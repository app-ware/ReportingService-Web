import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Browser, BrowserContext, chromium } from 'playwright';
import {
  REPORT_RUNTIME_CONFIG,
  ReportRuntimeConfig,
} from 'src/config/report.config';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

type FileExists = (filePath: string) => boolean;

export interface BrowserExecutableResolutionOptions {
  configuredPath?: string | null;
  playwrightExecutablePath?: string | null;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  fileExists?: FileExists;
}

function environmentValue(
  env: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const key = Object.keys(env).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  return key ? env[key] : undefined;
}

function systemBrowserCandidates(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): string[] {
  if (platform === 'win32') {
    const programFiles =
      environmentValue(env, 'ProgramFiles') || 'C:\\Program Files';
    const programFilesX86 =
      environmentValue(env, 'ProgramFiles(x86)') || 'C:\\Program Files (x86)';
    const localAppData = environmentValue(env, 'LocalAppData');
    const roots = [programFiles, programFilesX86, localAppData].filter(
      (root): root is string => !!root,
    );
    return [
      ...new Set([
        ...roots.map((root) =>
          path.win32.join(
            root,
            'Google',
            'Chrome',
            'Application',
            'chrome.exe',
          ),
        ),
        ...roots.map((root) =>
          path.win32.join(
            root,
            'Microsoft',
            'Edge',
            'Application',
            'msedge.exe',
          ),
        ),
      ]),
    ];
  }

  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }

  return [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/microsoft-edge-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome',
  ];
}

/**
 * Keeps Playwright's managed browser as the default, but recovers when dependencies were
 * installed without `npx playwright install` by using a locally installed browser.
 */
export function resolveBrowserExecutablePath({
  configuredPath,
  playwrightExecutablePath,
  platform = process.platform,
  env = process.env,
  fileExists = existsSync,
}: BrowserExecutableResolutionOptions): string | undefined {
  const configured = configuredPath?.trim();
  if (configured) return configured;

  if (playwrightExecutablePath && fileExists(playwrightExecutablePath)) {
    // Undefined deliberately preserves Playwright's normal executable resolution.
    return undefined;
  }

  return systemBrowserCandidates(platform, env).find(fileExists);
}

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
      this.logger.warn(
        { err: error },
        'Chromium warm-up failed; will retry on first render.',
      );
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
      throw new ServiceUnavailableException(
        'Reporting service is shutting down.',
      );
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
      this.logger.warn(
        'Previous Chromium instance is disconnected; relaunching.',
      );
      this.browser = null;
    }

    const playwrightExecutablePath = chromium.executablePath();
    const executablePath = resolveBrowserExecutablePath({
      configuredPath: this.config.browserExecutablePath,
      playwrightExecutablePath,
    });

    if (executablePath) {
      this.logger.warn(
        { executablePath },
        this.config.browserExecutablePath
          ? 'Using configured Chromium-compatible browser executable.'
          : 'Playwright browser is unavailable; using an installed system browser.',
      );
    }

    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      args: [
        // No untrusted content is loaded, and containers commonly cannot allocate the
        // shared memory Chromium's default /dev/shm sizing expects.
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    browser.on('disconnected', () => {
      if (!this.shuttingDown) {
        this.logger.error(
          'Chromium disconnected unexpectedly; next render will relaunch.',
        );
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
      this.logger.warn(
        { err: error },
        'Browser context creation failed; relaunching Chromium once.',
      );

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
