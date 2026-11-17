import { deflateSync } from 'zlib';
import {
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
import {
  REPORT_RUNTIME_CONFIG,
  ReportRuntimeConfig,
} from 'src/config/report.config';
import { ReportPayloadValidator } from 'src/common/report-contract/report-payload.validator';
import {
  ReportLocale,
  SUPPORTED_LOCALES,
} from 'src/common/report-contract/report-meta';
import { ReportType } from 'src/common/report-contract/report-schemas';
import { EvaluationReportsService } from 'src/modules/evaluation-report/evaluation-reports.service';
import { IncidentReportsService } from 'src/modules/incident-report/incident-reports.service';
import { InvoiceReportsService } from 'src/modules/invoice-report/invoice-reports.service';
import { ReceiptReportsService } from 'src/modules/receipt-report/receipt-reports.service';
import { PaySlipReportsService } from 'src/modules/payslip-report/payslip-reports.service';
import { InstallmentReportsService } from 'src/modules/installment-report/installment-reports.service';
import {
  FIXTURES,
  TINY_PNG,
  incidentFixture,
  installmentFixture,
  paySlipFixture,
  receiptFixture,
} from 'src/common/report-contract/test-fixtures';

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

const TEMPLATE_PATHS: Record<ReportType, string> = {
  evaluation: 'evaluation-reports/evaluation-report.hbs',
  incident: 'incident-report/incident-report.hbs',
  invoice: 'invoice-report/invoice-report.hbs',
  receipt: 'receipt-report/receipt-report.hbs',
  payslip: 'payslip-report/payslip-report.hbs',
  installment: 'installment-report/installment-report.hbs',
};

/** Page objects in the PDF. Chromium writes them uncompressed, so a scan is enough. */
function pageCount(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? [])
    .length;
}

/** Width and height of the first page's media box, in PDF points. */
function mediaBox(buffer: Buffer): [number, number] {
  const match =
    /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(
      buffer.toString('latin1'),
    );
  if (!match) {
    throw new Error('No MediaBox found in the PDF.');
  }
  return [
    Number(match[3]) - Number(match[1]),
    Number(match[4]) - Number(match[2]),
  ];
}

/** CRC-32 as PNG chunks require it. */
function crc32(bytes: Buffer): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

/** A solid-colour RGB PNG data URI of the given size, for banners of any aspect ratio. */
function solidPng(width: number, height: number): string {
  const chunk = (type: string, data: Buffer): Buffer => {
    const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB

  // Each scanline is a filter byte (0) followed by width RGB pixels.
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x4a)]);
  const pixels = deflateSync(
    Buffer.concat(Array.from({ length: height }, () => row)),
  );

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** A logger stub — `PinoLogger` is transient-scoped and cannot be pulled from `get()`. */
function stubLogger(): any {
  return {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
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

  let services: Record<
    ReportType,
    {
      createPdfFromData(
        payload: unknown,
        correlationId?: string,
      ): Promise<Buffer>;
    }
  >;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppLoggerModule, SharedModule, RenderModule],
      providers: [
        EvaluationReportsService,
        IncidentReportsService,
        InvoiceReportsService,
        ReceiptReportsService,
        PaySlipReportsService,
        InstallmentReportsService,
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
      payslip: moduleRef.get(PaySlipReportsService),
      installment: moduleRef.get(InstallmentReportsService),
    };
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  const reportTypes: ReportType[] = [
    'evaluation',
    'incident',
    'invoice',
    'receipt',
    'payslip',
    'installment',
  ];

  describe('every report renders a valid PDF in every locale', () => {
    const cases = reportTypes.flatMap((reportType) =>
      SUPPORTED_LOCALES.map(
        (locale) => [reportType, locale] as [ReportType, ReportLocale],
      ),
    );

    it.each(cases)('%s in %s', async (reportType, locale) => {
      const buffer = await services[reportType].createPdfFromData(
        FIXTURES[reportType](locale),
        'cid-render',
      );

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
        receiptFixture('en', {
          settings: { ...receiptFixture('en').settings, reportSize: 'A5' },
        }),
      );

      expect(isPdf(a4)).toBe(true);
      expect(isPdf(a5)).toBe(true);
      // Same content, different media box — the two documents cannot be byte-identical.
      expect(a4.equals(a5)).toBe(false);
    });

    it('prints A5 landscape, as the legacy half-sheet receipt was', async () => {
      const a5 = await services.receipt.createPdfFromData(
        receiptFixture('en', {
          settings: { ...receiptFixture('en').settings, reportSize: 'A5' },
        }),
      );

      const [width, height] = mediaBox(a5);
      expect(width).toBeGreaterThan(height);
    });
  });

  describe('installment slip', () => {
    it('prints A5 landscape, as the legacy slip was', async () => {
      const buffer = await services.installment.createPdfFromData(
        installmentFixture('en'),
      );

      const [width, height] = mediaBox(buffer);
      expect(width).toBeGreaterThan(height);
      // A5 landscape is about 595 x 420 pt (Chromium rounds to whole pixels).
      expect(Math.abs(width - 595)).toBeLessThan(3);
      expect(Math.abs(height - 420)).toBeLessThan(3);
    });

    it('turns the text footer off and keeps the footer margin small', async () => {
      const spy = jest.spyOn(renderer, 'render');
      try {
        await services.installment.createPdfFromData(installmentFixture('en'));

        const request = spy.mock.calls[spy.mock.calls.length - 1][0];
        expect(request.pdf.footerTemplate).toBeNull();
        expect(request.pdf.margin.bottom).toBe('15px');
      } finally {
        spy.mockRestore();
      }
    });

    it('turns the generated text footer off for receipt and invoice too', async () => {
      const spy = jest
        .spyOn(renderer, 'render')
        .mockResolvedValue(Buffer.from('%PDF-1.4'));
      try {
        await services.invoice.createPdfFromData(FIXTURES.invoice('en'));
        let request = spy.mock.calls[spy.mock.calls.length - 1][0];
        expect(request.pdf.footerTemplate).toBeNull();
        expect(request.pdf.margin.bottom).toBe('25px');

        await services.receipt.createPdfFromData(
          receiptFixture('en', { settings: { reportSize: 'A5' } }),
        );
        request = spy.mock.calls[spy.mock.calls.length - 1][0];
        expect(request.pdf.footerTemplate).toBeNull();
        expect(request.pdf.margin.bottom).toBe('15px');
      } finally {
        spy.mockRestore();
      }
    });
  });

  /**
   * Short reports stretch to fill their page so the signatures and footer banner sit at
   * the bottom. The stretch is sized to the printable height; if it were even slightly
   * too tall, every short report would gain an empty second page.
   */
  describe('page fill', () => {
    const wideBanner = solidPng(1600, 230);
    const withBranding = (
      payload: { settings: Record<string, unknown> },
      extra: Record<string, unknown> = {},
    ) => ({
      ...payload,
      settings: {
        ...payload.settings,
        useImages: true,
        includeFooter: true,
        headerImageBase64: wideBanner,
        footerImageBase64: wideBanner,
        ...extra,
      },
    });

    it.each([
      ['incident', () => withBranding(incidentFixture('en'))],
      [
        'invoice',
        () =>
          withBranding(
            FIXTURES.invoice('en') as { settings: Record<string, unknown> },
          ),
      ],
      ['payslip', () => withBranding(paySlipFixture('en'))],
      ['receipt A4', () => withBranding(receiptFixture('en'))],
      [
        'receipt A5',
        () => withBranding(receiptFixture('en'), { reportSize: 'A5' }),
      ],
      ['receipt A4 without images', () => receiptFixture('en')],
      ['installment', () => withBranding(installmentFixture('en'))],
    ] as [string, () => unknown][])(
      'keeps a short %s on exactly one page',
      async (label, payload) => {
        const reportType = label.split(' ')[0] as ReportType;
        const buffer = await services[reportType].createPdfFromData(payload());

        expect(pageCount(buffer)).toBe(1);
      },
    );
  });

  describe('shared receipt/invoice footer and signatures', () => {
    function payload(
      reportType: 'invoice' | 'receipt',
      settings: Record<string, unknown> = {},
      locale: ReportLocale = 'en',
    ) {
      const fixture = FIXTURES[reportType](locale) as {
        settings: Record<string, unknown>;
      };
      return {
        ...fixture,
        settings: { ...fixture.settings, footerImageBase64: null, ...settings },
      };
    }

    async function html(
      reportType: 'invoice' | 'receipt',
      settings: Record<string, unknown> = {},
    ) {
      const validated = validator.validate(
        reportType,
        payload(reportType, settings),
      );
      const context = localization.contextFor(reportType, validated.locale);
      return templates.render(TEMPLATE_PATHS[reportType], {
        ...(validated.data as object),
        labels: context.labels,
        lang: context.locale,
        dir: context.dir,
        fontFaceCss: fonts.fontFaceCss(),
        fontStack: fonts.fontStack(),
        pageFillHeight: '1000px',
      });
    }

    it.each(['invoice', 'receipt'] as const)(
      '%s falls back to Thank You! without an image or custom message',
      async (reportType) => {
        for (const footerMessage of [undefined, null, '', '   ']) {
          expect(await html(reportType, { footerMessage })).toContain(
            '>Thank You!</p>',
          );
        }
      },
    );

    it.each(['invoice', 'receipt'] as const)(
      '%s prints escaped custom footer and fineprint text',
      async (reportType) => {
        const markup = await html(reportType, {
          footerMessage: 'Thanks <script>bad()</script> & goodbye',
          fineprintMessage: 'Payment terms <b>remain</b>',
          fineprintVisible: true,
        });
        expect(markup).toContain(
          'Thanks &lt;script&gt;bad()&lt;/script&gt; &amp; goodbye',
        );
        expect(markup).toContain('Payment terms &lt;b&gt;remain&lt;/b&gt;');
        expect(markup).not.toContain('<script>');
        expect(markup).not.toContain('<b>remain</b>');
        expect(await html(reportType, { footerVisible: false })).not.toContain(
          'class="accounting-footer-message"',
        );
        expect(
          await html(reportType, {
            fineprintMessage: 'Hidden',
            fineprintVisible: false,
          }),
        ).not.toContain('>Hidden</p>');
      },
    );

    it.each(['invoice', 'receipt'] as const)(
      '%s keeps footer-image precedence and otherwise uses text',
      async (reportType) => {
        const settings = {
          includeFooter: true,
          footerImageBase64: TINY_PNG,
          footerMessage: 'Custom footer',
        };
        const withImage = await html(reportType, settings);
        expect(withImage).toContain('class="report-footer-banner"');
        expect(withImage).not.toContain('>Custom footer</p>');
        expect(
          await html(reportType, { ...settings, includeFooter: false }),
        ).toContain('>Custom footer</p>');
      },
    );

    it.each(['invoice', 'receipt'] as const)(
      'renders four fixed signature slots on one short %s',
      async (reportType) => {
        const buffer = await services[reportType].createPdfFromData(
          payload(reportType, {
            signatures: Array.from({ length: 4 }, (_, index) => ({
              slot: index + 1,
              visible: true,
              note: `Signature ${index + 1}`,
            })),
          }),
        );
        expect(isPdf(buffer)).toBe(true);
        expect(pageCount(buffer)).toBe(1);
      },
    );

    it.each(['invoice', 'receipt'] as const)(
      '%s keeps a disabled signature in its configured slot',
      async (reportType) => {
        const markup = await html(reportType, {
          signatures: [
            { slot: 1, visible: true, note: 'First' },
            { slot: 2, visible: false, note: 'Hidden' },
            { slot: 3, visible: true, note: 'Third' },
            { slot: 4, visible: true, note: 'Fourth' },
          ],
        });
        expect(markup.match(/class="accounting-signature"/g)).toHaveLength(4);
        expect(markup).toContain('style="grid-column: 2;"');
        expect(markup).not.toContain('>Hidden</div>');
        expect(markup).toContain('>Third</div>');
      },
    );

    it('keeps text-only signature slots fixed above the shared footer rule', async () => {
      const markup = await html('receipt', {
        signatures: Array.from({ length: 4 }, (_, index) => ({
          slot: index + 1,
          visible: index !== 1,
          note: `Signature ${index + 1}`,
        })),
      });
      const context = await browsers.newContext();
      try {
        const page = await context.newPage();
        await page.setViewportSize({ width: 744, height: 1123 });
        await page.setContent(markup, { waitUntil: 'load' });
        const measurements = await page.evaluate(() => {
          const footer = document
            .querySelector('.accounting-footer-message')!
            .getBoundingClientRect();
          const slots = [...document.querySelectorAll('.accounting-signature')];
          const visibleNotes = [
            ...document.querySelectorAll('.accounting-signature-note'),
          ];
          return {
            slotLefts: slots.map((slot) => slot.getBoundingClientRect().left),
            hiddenText: slots[1].textContent?.trim(),
            signaturePaddingBottom: Number.parseFloat(
              getComputedStyle(
                document.querySelector('.accounting-signatures')!,
              ).paddingBottom,
            ),
            borderTop: getComputedStyle(
              document.querySelector('.accounting-footer-message')!,
            ).borderTopWidth,
            noteBottoms: visibleNotes.map(
              (note) => note.getBoundingClientRect().bottom,
            ),
            footerTop: footer.top,
          };
        });
        expect(measurements.slotLefts).toHaveLength(4);
        expect(new Set(measurements.slotLefts).size).toBe(4);
        expect(measurements.hiddenText).toBe('');
        expect(measurements.signaturePaddingBottom).toBe(64);
        expect(measurements.borderTop).not.toBe('0px');
        for (const noteBottom of measurements.noteBottoms) {
          expect(measurements.footerTop - noteBottom).toBeGreaterThanOrEqual(
            measurements.signaturePaddingBottom,
          );
        }
      } finally {
        await context.close();
      }
    });

    it('renders long invoices with the closing block following the fee table', async () => {
      const data = payload('invoice', {
        footerMessage: 'Custom closing',
        signatures: [{ slot: 1, visible: true, note: 'Parent' }],
      }) as any;
      data.invoice.feeLines = Array.from({ length: 90 }, (_, index) => ({
        title: `Fee ${index + 1}`,
        amount: '10.00',
      }));
      const buffer = await services.invoice.createPdfFromData(data);
      expect(isPdf(buffer)).toBe(true);
      expect(pageCount(buffer)).toBeGreaterThan(1);
    });

    it('bounds signature notes, slots and count at the renderer boundary', () => {
      for (const signatures of [
        Array.from({ length: 5 }, () => ({ note: 'Extra' })),
        [{ note: 'x'.repeat(513) }],
        [{ slot: 5, visible: true, note: 'Outside the grid' }],
      ]) {
        expect(() =>
          validator.validate('invoice', payload('invoice', { signatures })),
        ).toThrow();
        expect(() =>
          validator.validate('receipt', payload('receipt', { signatures })),
        ).toThrow();
      }
    });
  });

  /**
   * Each center uploads its own header banner, so the layout has to hold for any aspect
   * ratio. The rendered HTML is laid out in Chromium at A4 content width and the banner
   * is measured: capped in height, and never overlapping the content that follows it.
   */
  describe('branding banner layout', () => {
    const A4_CONTENT_WIDTH_PX = 794 - 50;
    const BANNER_MAX_HEIGHT_PX = 110;

    const banners: [string, string][] = [
      ['wide (10:1)', solidPng(1600, 160)],
      ['square', solidPng(400, 400)],
      ['tall (1:4)', solidPng(200, 800)],
      ['1x1', TINY_PNG],
    ];

    const cases = reportTypes.flatMap((reportType) =>
      banners.map(
        ([label, image]) =>
          [reportType, label, image] as [ReportType, string, string],
      ),
    );

    it.each(cases)(
      '%s keeps a %s banner capped and clear of the content',
      async (reportType, _label, image) => {
        const fixture = FIXTURES[reportType]('en') as {
          settings: Record<string, unknown>;
        };
        const payload = {
          ...fixture,
          settings: {
            ...fixture.settings,
            useImages: true,
            headerImageBase64: image,
          },
        };
        const validated = validator.validate(reportType, payload);
        const context = localization.contextFor(reportType, validated.locale);

        const markup = await templates.render(TEMPLATE_PATHS[reportType], {
          ...(validated.data as object),
          lang: context.locale,
          dir: context.dir,
          isRtl: context.isRtl,
          labels: context.labels,
          fontFaceCss: fonts.fontFaceCss(),
          fontStack: fonts.fontStack(),
        });

        const browserContext = await browsers.newContext();
        try {
          const page = await browserContext.newPage();
          await page.setViewportSize({
            width: A4_CONTENT_WIDTH_PX,
            height: 1123,
          });
          await page.setContent(markup, { waitUntil: 'load' });

          const box = await page.evaluate(() => {
            const banner = document.querySelector('.report-banner');
            const img = banner?.querySelector('img');
            const next = banner?.nextElementSibling;
            if (!banner || !img || !next) {
              return null;
            }
            return {
              imgHeight: img.getBoundingClientRect().height,
              bannerBottom: banner.getBoundingClientRect().bottom,
              nextTop: next.getBoundingClientRect().top,
            };
          });

          expect(box).not.toBeNull();
          expect(box!.imgHeight).toBeGreaterThan(0);
          expect(box!.imgHeight).toBeLessThanOrEqual(
            BANNER_MAX_HEIGHT_PX + 0.5,
          );
          expect(box!.nextTop).toBeGreaterThanOrEqual(box!.bannerBottom);
        } finally {
          await browserContext.close();
        }
      },
    );

    it('expands 1600x230 header and footer images to the A5 printable width', async () => {
      const wideBanner = solidPng(1600, 230);
      const fixture = installmentFixture('en', {
        settings: {
          useImages: true,
          includeFooter: true,
          headerImageBase64: wideBanner,
          footerImageBase64: wideBanner,
        },
      });
      const validated = validator.validate('installment', fixture);
      const context = localization.contextFor(
        'installment',
        validated.locale,
      );
      const markup = await templates.render(TEMPLATE_PATHS.installment, {
        ...(validated.data as object),
        lang: context.locale,
        dir: context.dir,
        isRtl: context.isRtl,
        labels: context.labels,
        fontFaceCss: fonts.fontFaceCss(),
        fontStack: fonts.fontStack(),
        pageFillHeight: '390px',
      });

      const browserContext = await browsers.newContext();
      try {
        const page = await browserContext.newPage();
        // A5 landscape at 96dpi minus the service's 15px left/right PDF margins.
        await page.setViewportSize({ width: 764, height: 420 });
        await page.setContent(markup, { waitUntil: 'load' });
        const boxes = await page.evaluate(() =>
          ['.report-banner', '.report-footer-banner'].map((selector) => {
            const container = document.querySelector(selector)!;
            const image = container.querySelector('img')!;
            return {
              containerWidth: container.getBoundingClientRect().width,
              imageWidth: image.getBoundingClientRect().width,
              imageHeight: image.getBoundingClientRect().height,
            };
          }),
        );

        for (const box of boxes) {
          expect(Math.abs(box.containerWidth - box.imageWidth)).toBeLessThan(
            1,
          );
          expect(box.imageHeight).toBeLessThanOrEqual(110.5);
        }
      } finally {
        await browserContext.close();
      }
    });
  });

  /**
   * These assert on the HTML the pipeline feeds Chromium. Text is not reliably extractable
   * from a PDF without a parser dependency, so label, direction and escaping behaviour is
   * verified at the last point where it is still inspectable — then the PDF assertions
   * above prove that same HTML renders.
   */
  describe('generated HTML', () => {
    async function html(
      reportType: ReportType,
      locale: ReportLocale,
      payload?: unknown,
    ): Promise<string> {
      const validated = validator.validate(
        reportType,
        payload ?? FIXTURES[reportType](locale),
      );
      const context = localization.contextFor(reportType, validated.locale);

      const templatePath = TEMPLATE_PATHS[reportType];

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

    it.each(reportTypes)(
      'sets lang and dir to rtl for Arabic (%s)',
      async (reportType) => {
        const markup = await html(reportType, 'ar');

        expect(markup).toContain('lang="ar"');
        expect(markup).toContain('dir="rtl"');
      },
    );

    it.each(reportTypes)(
      'sets lang and dir to ltr for English (%s)',
      async (reportType) => {
        const markup = await html(reportType, 'en');

        expect(markup).toContain('lang="en"');
        expect(markup).toContain('dir="ltr"');
      },
    );

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
          expect(await html(reportType, locale)).not.toMatch(
            /reports\.[a-z]+\.[a-zA-Z]+/,
          );
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

    it('prints every pay slip line and omits the deductions section when there are none', async () => {
      const full = await html('payslip', 'en');

      expect(full).toContain('Basic Salary');
      expect(full).toContain('Transport allowance');
      expect(full).toContain('Social insurance');
      expect(full).toContain('9,600.00');

      const noDeductions = await html(
        'payslip',
        'en',
        paySlipFixture('en', {
          paySlip: { deductions: [], totalDeductions: '0.00' },
        }),
      );

      expect(noDeductions).not.toContain('Total Deductions:');
      expect(noDeductions).toContain('Net Income:');
    });

    it.each([
      ['en', 'pending', 'Pending'],
      ['en', 'paid', 'Paid'],
      ['en', 'cancelled', 'Cancelled'],
      ['fr', 'paid', 'Payé'],
      ['ar', 'cancelled', 'ملغى'],
    ] as [ReportLocale, string, string][])(
      'prints the %s installment status %s as "%s"',
      async (locale, status, label) => {
        const markup = decodeEntities(
          await html(
            'installment',
            locale,
            installmentFixture(locale, { installment: { status } }),
          ),
        );

        expect(markup).toContain(label);
      },
    );

    it('prints the installment position and keeps the amount as supplied', async () => {
      const markup = await html('installment', 'ar');

      expect(markup).toContain('1 / 10');
      expect(markup).toContain('2,532.00');
      expect(markup).toContain('USD');
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
          incident: {
            description:
              '<script>fetch("http://evil.example")</script><b>bold</b>',
          },
        });

        const markup = await html('incident', 'en', payload);

        expect(markup).not.toContain('<script>');
        expect(markup).not.toContain('<b>bold</b>');
        expect(markup).toContain('&lt;script&gt;');
      });

      it('escapes markup in a student name', async () => {
        const payload = incidentFixture('en', {
          student: { name: '<img src=x onerror=alert(1)>' },
        });
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
      [
        'a remote stylesheet',
        '<link rel="stylesheet" href="http://127.0.0.1:9/evil.css">',
      ],
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
        pdf: {
          format: 'A4',
          margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' },
          footerTemplate: '<div></div>',
        },
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
        pdf: {
          format: 'A4',
          margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' },
          footerTemplate: '<div></div>',
        },
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
          pdf: {
            format: 'A4',
            margin: {
              top: '10px',
              right: '10px',
              bottom: '10px',
              left: '10px',
            },
            footerTemplate: '<div></div>',
          },
        }),
      ).rejects.toThrow(GatewayTimeoutException);
    });

    it('sheds load with 503 once concurrency and queue depth are exhausted', async () => {
      const saturated = new RenderQueueService({
        ...config,
        maxConcurrentRenders: 1,
        maxQueueDepth: 0,
      });

      const first = saturated.run(
        () => new Promise((resolve) => setTimeout(() => resolve('ok'), 200)),
      );
      await Promise.resolve();

      await expect(saturated.run(async () => 'second')).rejects.toThrow(
        ServiceUnavailableException,
      );
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
      await expect(
        services.incident.createPdfFromData({
          meta: { schemaVersion: 1, locale: 'en' },
        }),
      ).rejects.toThrow();

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

      const buffer = await services.incident.createPdfFromData(
        incidentFixture('en'),
      );

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
