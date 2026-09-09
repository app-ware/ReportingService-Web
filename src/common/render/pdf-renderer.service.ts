import {
  GatewayTimeoutException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { BrowserContext, Route } from 'playwright';
import { BrowserManagerService } from './browser-manager.service';
import { RenderQueueService } from './render-queue.service';
import { REPORT_RUNTIME_CONFIG, ReportRuntimeConfig } from 'src/config/report.config';
import { ReportLocale } from 'src/common/report-contract/report-meta';
import { ReportType } from 'src/common/report-contract/report-schemas';

export interface PdfPageOptions {
  format: 'A4' | 'A5';
  margin: { top: string; right: string; bottom: string; left: string };
  footerTemplate: string;
}

export interface RenderRequest {
  reportType: ReportType;
  locale: ReportLocale;
  schemaVersion: number;
  unversioned: boolean;
  payloadBytes: number;
  strippedFieldCount: number;
  correlationId?: string;
  html: string;
  pdf: PdfPageOptions;
}

/**
 * URL schemes a report page is allowed to resolve while rendering.
 *
 * Everything a report needs is already inline — the HTML, the CSS, the fonts and the
 * images all arrive as part of the payload or the bundle. So nothing legitimate remains
 * to be fetched, and `http:`/`https:`/`file:` are all denied: that closes both SSRF
 * through a crafted payload and local-file exfiltration through a `file:` reference.
 */
const ALLOWED_REQUEST_SCHEMES: ReadonlySet<string> = new Set(['data:', 'about:', 'blob:']);

@Injectable()
export class PdfRendererService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly browsers: BrowserManagerService,
    private readonly queue: RenderQueueService,
    @Inject(REPORT_RUNTIME_CONFIG) private readonly config: ReportRuntimeConfig,
  ) {
    this.logger.setContext(PdfRendererService.name);
  }

  /**
   * Renders one report to a PDF buffer.
   *
   * Admission through the bounded queue happens first, so an overloaded service sheds
   * load before it allocates a browser context.
   */
  async render(request: RenderRequest): Promise<Buffer> {
    const startedAt = Date.now();

    try {
      const buffer = await this.queue.run(() => this.renderOnce(request));

      this.logTelemetry(request, {
        outcome: 'success',
        durationMs: Date.now() - startedAt,
        pdfBytes: buffer.length,
      });

      return buffer;
    } catch (error) {
      const timedOut = this.isTimeout(error);

      this.logTelemetry(request, {
        outcome: timedOut ? 'timeout' : this.outcomeFor(error),
        durationMs: Date.now() - startedAt,
        errorName: (error as Error)?.name,
      });

      if (timedOut) {
        throw new GatewayTimeoutException('Report rendering exceeded the configured time limit.');
      }
      // A queue rejection is already a ServiceUnavailableException and must pass through
      // so that Nursery can map "busy" separately from "renderer failed".
      if (this.isHttpException(error)) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to generate PDF.');
    }
  }

  private async renderOnce(request: RenderRequest): Promise<Buffer> {
    let context: BrowserContext | undefined;

    try {
      context = await this.browsers.newContext();
      await context.route('**/*', (route) => this.guardRequest(route, request));

      const page = await context.newPage();
      page.setDefaultTimeout(this.config.renderTimeoutMs);

      // `domcontentloaded` rather than `networkidle`: every resource is inline, so there is
      // no network to go idle, and `networkidle` would just wait out its own timeout.
      await page.setContent(request.html, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.renderTimeoutMs,
      });

      // Web fonts are embedded but still load asynchronously; laying out Arabic before
      // they are ready produces a fallback-metric PDF.
      await page
        .evaluate(() => document.fonts.ready.then(() => undefined))
        .catch(() => undefined);

      const buffer = await page.pdf({
        format: request.pdf.format,
        printBackground: true,
        margin: request.pdf.margin,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: request.pdf.footerTemplate,
      });

      return buffer;
    } finally {
      // Always, on every path: a leaked context is a leaked renderer process.
      if (context) {
        await context.close().catch((error) => {
          this.logger.warn({ err: error }, 'Failed to close browser context after render.');
        });
      }
    }
  }

  /**
   * Denies any request whose scheme is not inline-only, and logs the scheme (never the
   * URL, which could carry payload content).
   */
  private async guardRequest(route: Route, request: RenderRequest): Promise<void> {
    const url = route.request().url();
    const scheme = url.slice(0, Math.max(0, url.indexOf(':') + 1)).toLowerCase();

    if (ALLOWED_REQUEST_SCHEMES.has(scheme)) {
      await route.continue().catch(() => undefined);
      return;
    }

    this.logger.warn(
      {
        correlationId: request.correlationId,
        reportType: request.reportType,
        scheme: scheme || 'unknown',
        resourceType: route.request().resourceType(),
      },
      'Blocked an outbound request from a report render.',
    );

    await route.abort('blockedbyclient').catch(() => undefined);
  }

  private isTimeout(error: unknown): boolean {
    const name = (error as Error)?.name ?? '';
    const message = (error as Error)?.message ?? '';
    return name === 'TimeoutError' || /timeout/i.test(message);
  }

  private isHttpException(error: unknown): boolean {
    return typeof (error as { getStatus?: unknown })?.getStatus === 'function';
  }

  private outcomeFor(error: unknown): string {
    if (this.isHttpException(error)) {
      const status = (error as { getStatus: () => number }).getStatus();
      return status === 503 ? 'busy' : `error-${status}`;
    }
    return 'error';
  }

  /**
   * Structured, PII-free render telemetry.
   *
   * Deliberately excluded: the payload itself, student/parent/center names, any report
   * text, images, filenames and the internal API key. What is kept is enough to reason
   * about behaviour and capacity — sizes and counts, never content — plus
   * `unversionedContract`, which is the signal that decides when the unversioned
   * compatibility path can finally be removed.
   */
  private logTelemetry(
    request: RenderRequest,
    result: { outcome: string; durationMs: number; pdfBytes?: number; errorName?: string },
  ): void {
    const { active, queued } = this.queue.snapshot();

    const telemetry = {
      correlationId: request.correlationId,
      reportType: request.reportType,
      locale: request.locale,
      schemaVersion: request.schemaVersion,
      unversionedContract: request.unversioned,
      payloadBytes: request.payloadBytes,
      strippedFieldCount: request.strippedFieldCount,
      pdfBytes: result.pdfBytes,
      renderDurationMs: result.durationMs,
      activeRenders: active,
      queuedRenders: queued,
      outcome: result.outcome,
      errorName: result.errorName,
    };

    if (result.outcome === 'success') {
      this.logger.info(telemetry, 'Report rendered.');
    } else {
      this.logger.error(telemetry, 'Report render did not complete.');
    }
  }
}
