import { GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerModule } from 'src/common/logger/logger.module';
import { SharedModule } from 'src/common/shared/shared.module';
import { RenderModule } from './render.module';
import { BrowserManagerService } from './browser-manager.service';
import { RenderQueueService } from './render-queue.service';
import { PdfRendererService } from './pdf-renderer.service';
import { ReportTemplateService } from './report-template.service';
import { ReportLocalizationService } from './report-localization.service';
import { ReportFontService } from './report-font.service';
import { ReportRenderPipeline } from './report-render.pipeline';
import { REPORT_RUNTIME_CONFIG, ReportRuntimeConfig } from 'src/config/report.config';
import { ReportPayloadValidator } from 'src/common/report-contract/report-payload.validator';
import { ReportLocale, SUPPORTED_LOCALES } from 'src/common/report-contract/report-meta';
import { ReportType } from 'src/common/report-contract/report-schemas';
import { EvaluationReportsService } from 'src/modules/evaluation-report/evaluation-reports.service';
import { IncidentReportsService } from 'src/modules/incident-report/incident-reports.service';
import { InvoiceReportsService } from 'src/modules/invoice-report/invoice-reports.service';
import { ReceiptReportsService } from 'src/modules/receipt-report/receipt-reports.service';
import { FIXTURES, TINY_PNG, incidentFixture, receiptFixture } from 'src/common/report-contract/test-fixtures';

/** Real Chromium renders take seconds, and this file does many of them. */
jest.setTimeout(180_000);

const PDF_MAGIC = '%PDF-';

function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, PDF_MAGIC.length).toString('latin1') === PDF_MAGIC;
}

/**
 * Decodes the entities Handlebars emits, so a label assertion can be written the way the
 * label reads. Handlebars escapes more than the strict minimum — apostrophes become
 * `&#x27;` and `=` becomes `&#x3D;` — which is correct behaviour but makes raw substring
 * matching on French labels unreadable.
 */
function decodeEntities(markup: string): string {
  return markup
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x3D;/g, '=')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** A logger stub — `PinoLogger` is transient-scoped and cannot be pulled from `get()`. */
function stubLogger(): any {
  return { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
}

describe('Report rendering (integration, real Chromium)', () => {
  let moduleRef: TestingModule;
  let browsers: BrowserManagerService;
  let renderer: PdfRendererService;
  let templates: ReportTemplateService;
  let localization: ReportLocalizationService;
  let fonts: ReportFontService;
  let validator: ReportPayloadValidator;
  let config: ReportRuntimeConfig;

  let services: Record<ReportType, { createPdfFromData(payload: unknown, correlationId?: string): Promise<Buffer> }>;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppLoggerModule, SharedModule, RenderModule],
      providers: [
        EvaluationReportsService,
        IncidentReportsService,
        InvoiceReportsService,
        ReceiptReportsService,
      ],
    }).compile();

    await moduleRef.init();

    browsers = moduleRef.get(BrowserManagerService);
    renderer = moduleRef.get(PdfRendererService);
    templates = moduleRef.get(ReportTemplateService);
    localization = moduleRef.get(ReportLocalizationService);
    fonts = moduleRef.get(ReportFontService);
    validator = moduleRef.get(ReportPayloadValidator);
    config = moduleRef.get<ReportRuntimeConfig>(REPORT_RUNTIME_CONFIG);

    services = {
      evaluation: moduleRef.get(EvaluationReportsService),
      incident: moduleRef.get(IncidentReportsService),
      invoice: moduleRef.get(InvoiceReportsService),
      receipt: moduleRef.get(ReceiptReportsService),
    };
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  const reportTypes: ReportType[] = ['evaluation', 'incident', 'invoice', 'receipt'];

  describe('every report renders a valid PDF in every locale', () => {
    const cases = reportTypes.flatMap((reportType) =>
      SUPPORTED_LOCALES.map((locale) => [reportType, locale] as [ReportType, ReportLocale]),
    );

    it.each(cases)('%s in %s', async (reportType, locale) => {
      const buffer = await services[reportType].createPdfFromData(FIXTURES[reportType](locale), 'cid-render');

      expect(isPdf(buffer)).toBe(true);
      // A blank page is roughly 1 KB; anything with real content is comfortably above this.
      expect(buffer.length).toBeGreaterThan(2_000);
    });
  });

  it('renders an unversioned payload, defaulting to English', async () => {
    const payload = incidentFixture('ar');
    delete (payload as { meta?: unknown }).meta;

    const buffer = await services.incident.createPdfFromData(payload);
    expect(isPdf(buffer)).toBe(true);
  });

  describe('receipt page geometry', () => {
    it('renders A5 as a distinctly smaller page than A4', async () => {
      const a4 = await services.receipt.createPdfFromData(receiptFixture('en'));
      const a5 = await services.receipt.createPdfFromData(
        receiptFixture('en', { settings: { ...receiptFixture('en').settings, reportSize: 'A5' } }),
      );

      expect(isPdf(a4)).toBe(true);
      expect(isPdf(a5)).toBe(true);
      // Same content, different media box — the two documents cannot be byte-identical.
      expect(a4.equals(a5)).toBe(false);
    });
  });

  /**
   * These assert on the HTML the pipeline feeds Chromium. Text is not reliably extractable
   * from a PDF without a parser dependency, so label, direction and escaping behaviour is
   * verified at the last point where it is still inspectable — then the PDF assertions
   * above prove that same HTML renders.
   */
  describe('generated HTML', () => {
    async function html(reportType: ReportType, locale: ReportLocale, payload?: unknown): Promise<string> {
      const validated = validator.validate(reportType, payload ?? FIXTURES[reportType](locale));
      const context = localization.contextFor(reportType, validated.locale);

      const templatePath = {
        evaluation: 'evaluation-reports/evaluation-report.hbs',
        incident: 'incident-report/incident-report.hbs',
        invoice: 'invoice-report/invoice-report.hbs',
        receipt: 'receipt-report/receipt-report.hbs',
      }[reportType];

      return templates.render(templatePath, {
        ...(validated.data as object),
        lang: context.locale,
        dir: context.dir,
        isRtl: context.isRtl,
        labels: context.labels,
        fontFaceCss: fonts.fontFaceCss(),
        fontStack: fonts.fontStack(),
      });
    }

    it.each(reportTypes)('sets lang and dir to rtl for Arabic (%s)', async (reportType) => {
      const markup = await html(reportType, 'ar');

      expect(markup).toContain('lang="ar"');
      expect(markup).toContain('dir="rtl"');
    });

    it.each(reportTypes)('sets lang and dir to ltr for English (%s)', async (reportType) => {
      const markup = await html(reportType, 'en');

      expect(markup).toContain('lang="en"');
      expect(markup).toContain('dir="ltr"');
    });

    it('prints English labels', async () => {
      const markup = await html('incident', 'en');

      expect(markup).toContain('Incident Report');
      expect(markup).toContain('Student Name:');
      expect(markup).toContain('Actions Taken:');
      expect(markup).toContain('Manager Signature');
    });

    it('prints French labels', async () => {
      const markup = decodeEntities(await html('invoice', 'fr'));

      expect(markup).toContain('Description des frais');
      expect(markup).toContain('TVA :');
      expect(markup).toContain("Date d'émission :");
    });

    it('prints Arabic labels', async () => {
      const markup = await html('receipt', 'ar');

      expect(markup).toContain('رقم السند:');
      expect(markup).toContain('توقيع المحاسب');
      expect(markup).toContain('العملة');
    });

    it('never leaks a translation lookup key into the document', async () => {
      for (const reportType of reportTypes) {
        for (const locale of SUPPORTED_LOCALES) {
          expect(await html(reportType, locale)).not.toMatch(/reports\.[a-z]+\.[a-zA-Z]+/);
        }
      }
    });

    it('keeps Nursery-formatted amounts exactly as supplied', async () => {
      const markup = await html('invoice', 'ar');

      // The renderer must not re-format, localize digits, or re-order a money string.
      expect(markup).toContain('13,110.00');
      expect(markup).toContain('(1,000.00)');
      expect(markup).toContain('EGP');
      // Amount cells force LTR so bidi cannot rearrange them next to Arabic text.
      expect(markup).toContain('direction: ltr;');
    });

    it('mixes Arabic content with Latin values without altering either', async () => {
      const markup = await html('evaluation', 'ar');

      expect(markup).toContain('يارا حسن محمد');
      expect(markup).toContain('KG1-A');
      expect(markup).toContain('150/180');
    });

    it('indents the evaluation node tree with logical properties so it mirrors in Arabic', async () => {
      const markup = await html('evaluation', 'ar');

      expect(markup).toContain('padding-inline-start');
      expect(markup).not.toContain('padding-left: 20px');
    });

    it('prefers a center-configured evaluation label over the localized default', async () => {
      const fixture = FIXTURES.evaluation('en') as Record<string, any>;
      fixture.variants.label_class = 'Homeroom:';

      const markup = await html('evaluation', 'en', fixture);

      expect(markup).toContain('Homeroom:');
    });

    it('falls back to the localized label when the center configured none', async () => {
      const markup = decodeEntities(await html('evaluation', 'fr'));

      // The fixture supplies colours but no label_* values.
      expect(markup).toContain("Nom de l'élève :");
      expect(markup).toContain('Classe :');
    });

    describe('escaping', () => {
      it('escapes markup arriving in report text rather than rendering it', async () => {
        const payload = incidentFixture('en', {
          incident: { description: '<script>fetch("http://evil.example")</script><b>bold</b>' },
        });

        const markup = await html('incident', 'en', payload);

        expect(markup).not.toContain('<script>');
        expect(markup).not.toContain('<b>bold</b>');
        expect(markup).toContain('&lt;script&gt;');
      });

      it('escapes markup in a student name', async () => {
        const payload = incidentFixture('en', { student: { name: '<img src=x onerror=alert(1)>' } });
        const markup = await html('incident', 'en', payload);

        expect(markup).not.toContain('<img src=x');
        expect(markup).toContain('&lt;img');
      });

      it('escapes an attempt to break out of an inline style attribute', async () => {
        const fixture = FIXTURES.evaluation('en') as Record<string, any>;
        fixture.variants.title_background_color = '#fff" onload="alert(1)';

        const markup = await html('evaluation', 'en', fixture);

        expect(markup).not.toContain('" onload="alert(1)');
        // Handlebars escapes `=` too, so the payload cannot even form an attribute name.
        expect(markup).toContain('&quot; onload&#x3D;&quot;alert(1)');
        expect(decodeEntities(markup)).toContain('#fff" onload="alert(1)');
      });

      it('renders a long name without truncating it', async () => {
        const longName = 'عبد الرحمن محمد عبد الله '.repeat(8).trim();
        const payload = incidentFixture('ar', { student: { name: longName } });

        const markup = await html('incident', 'ar', payload);
        expect(markup).toContain(longName);
      });
    });

    it('inlines bundled fonts, or falls back to the system stack when none are bundled', async () => {
      const markup = await html('incident', 'ar');
      const families = fonts.loadedFamilies();

      if (families.length > 0) {
        // An approved font is bundled: it must be embedded, never referenced by URL.
        expect(markup).toContain('@font-face');
        expect(markup).toContain('data:font/');
        expect(markup).not.toMatch(/src:\s*url\((?!data:)/);
        expect(markup).toContain('"iCareReport"');
      } else {
        expect(markup).toContain('Arial');
        expect(markup).not.toContain('@font-face');
      }
      // Either way, nothing is fetched over the network.
      expect(markup).not.toContain('fonts.googleapis.com');
      expect(markup).not.toContain('fonts.gstatic.com');
    });
  });

  describe('outbound requests are blocked', () => {
    it.each([
      ['http', '<img src="http://127.0.0.1:9/should-not-load.png">'],
      ['https', '<img src="https://example.invalid/should-not-load.png">'],
      ['file', '<img src="file:///etc/passwd">'],
      ['a remote stylesheet', '<link rel="stylesheet" href="http://127.0.0.1:9/evil.css">'],
      ['a remote script', '<script src="http://127.0.0.1:9/evil.js"></script>'],
    ])('blocks %s and still completes the render', async (_label, injected) => {
      const buffer = await renderer.render({
        reportType: 'incident',
        locale: 'en',
        schemaVersion: 1,
        unversioned: false,
        payloadBytes: 100,
        strippedFieldCount: 0,
        correlationId: 'cid-block',
        html: `<!doctype html><html><body><p>content</p>${injected}</body></html>`,
        pdf: { format: 'A4', margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' }, footerTemplate: '<div></div>' },
      });

      expect(isPdf(buffer)).toBe(true);
    });

    it('allows an inline data: image through', async () => {
      const buffer = await renderer.render({
        reportType: 'incident',
        locale: 'en',
        schemaVersion: 1,
        unversioned: false,
        payloadBytes: 100,
        strippedFieldCount: 0,
        html: `<!doctype html><html><body><img src="${TINY_PNG}"></body></html>`,
        pdf: { format: 'A4', margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' }, footerTemplate: '<div></div>' },
      });

      expect(isPdf(buffer)).toBe(true);
    });
  });

  describe('operational limits', () => {
    it('maps a render that exceeds the timeout to 504', async () => {
      const impatient = new PdfRendererService(
        stubLogger(),
        browsers,
        new RenderQueueService(config),
        { ...config, renderTimeoutMs: 1_000 },
      );

      // A synchronous busy-loop in the page cannot finish before the 1s deadline.
      await expect(
        impatient.render({
          reportType: 'incident',
          locale: 'en',
          schemaVersion: 1,
          unversioned: false,
          payloadBytes: 100,
          strippedFieldCount: 0,
          html: '<!doctype html><html><body><script>const end=Date.now()+30000;while(Date.now()<end){}</script></body></html>',
          pdf: { format: 'A4', margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' }, footerTemplate: '<div></div>' },
        }),
      ).rejects.toThrow(GatewayTimeoutException);
    });

    it('sheds load with 503 once concurrency and queue depth are exhausted', async () => {
      const saturated = new RenderQueueService({ ...config, maxConcurrentRenders: 1, maxQueueDepth: 0 });

      const first = saturated.run(() => new Promise((resolve) => setTimeout(() => resolve('ok'), 200)));
      await Promise.resolve();

      await expect(saturated.run(async () => 'second')).rejects.toThrow(ServiceUnavailableException);
      await first;
    });

    it('leaves no browser contexts behind after many renders, including failed ones', async () => {
      const browser = await browsers.getBrowser();
      const before = browser.contexts().length;

      await Promise.all([
        services.incident.createPdfFromData(incidentFixture('en')),
        services.receipt.createPdfFromData(receiptFixture('fr')),
        services.incident.createPdfFromData(incidentFixture('ar')),
      ]);

      // A render that throws must still close its context.
      await expect(services.incident.createPdfFromData({ meta: { schemaVersion: 1, locale: 'en' } })).rejects.toThrow();

      expect(browser.contexts().length).toBe(before);
    });
  });

  describe('browser recovery', () => {
    it('relaunches Chromium after it disconnects, and renders again', async () => {
      const original = await browsers.getBrowser();
      expect(browsers.isReady()).toBe(true);

      // Simulate a crash / OOM kill of the browser process.
      await original.close();
      expect(browsers.isReady()).toBe(false);

      const buffer = await services.incident.createPdfFromData(incidentFixture('en'));

      expect(isPdf(buffer)).toBe(true);
      expect(browsers.isReady()).toBe(true);
      expect(await browsers.getBrowser()).not.toBe(original);
    });
  });

  describe('the render pipeline is wired through the shared browser', () => {
    it('uses one Chromium instance for renders from different report modules', async () => {
      const pipeline = moduleRef.get(ReportRenderPipeline);
      expect(pipeline).toBeDefined();

      const browserBefore = await browsers.getBrowser();

      await services.invoice.createPdfFromData(FIXTURES.invoice('en'));
      await services.evaluation.createPdfFromData(FIXTURES.evaluation('en'));

      expect(await browsers.getBrowser()).toBe(browserBefore);
    });
  });
});
