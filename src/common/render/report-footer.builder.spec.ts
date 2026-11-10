import { PinoLogger } from 'nestjs-pino';
import { ReportFooterBuilder, escapeHtml } from './report-footer.builder';
import { LocalizedReportContext } from './report-localization.service';


function fakeLogger(): PinoLogger {
  return {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as PinoLogger;
}

function context(locale: 'en' | 'ar', labels: Record<string, string> = {}): LocalizedReportContext {
  const isRtl = locale === 'ar';
  return {
    locale,
    dir: isRtl ? 'rtl' : 'ltr',
    isRtl,
    labels: {
      common: { page: 'Page', of: 'of', ...labels },
      report: {},
    },
  };
}

describe('ReportFooterBuilder', () => {
  let logger: PinoLogger;
  let builder: ReportFooterBuilder;

  beforeEach(() => {
    logger = fakeLogger();
    builder = new ReportFooterBuilder(logger);
  });

  it('renders a text footer with page numbering and the default bottom margin', () => {
    const { footerTemplate, marginBottom } = builder.build({
      localization: context('en'),
      title: 'Incident Report',
    });

    expect(footerTemplate).toContain('Incident Report');
    expect(footerTemplate).toContain('class="pageNumber"');
    expect(footerTemplate).toContain('class="totalPages"');
    expect(footerTemplate).toContain('dir="ltr"');
    expect(marginBottom).toBe('40px');
  });

  it('mirrors the footer for Arabic', () => {
    const { footerTemplate } = builder.build({
      localization: context('ar', { page: 'صفحة', of: 'من' }),
      title: 'تقرير حادث',
    });

    expect(footerTemplate).toContain('dir="rtl"');
    expect(footerTemplate).toContain('تقرير حادث');
    expect(footerTemplate).toContain('صفحة');
    // The leading slot sits on the right edge in RTL.
    expect(footerTemplate).toContain('text-align: right;');
    expect(footerTemplate).toContain('text-align: left;');
  });

  it('honours per-report margin overrides', () => {
    const { marginBottom } = builder.build({
      localization: context('en'),
      title: 'Receipt',
      marginBottom: '30px',
    });

    expect(marginBottom).toBe('30px');
  });

  it('never draws an image in the per-page footer — the banner is printed once in the body', () => {
    const { footerTemplate } = builder.build({
      localization: context('en'),
      title: 'Invoice Report',
    });

    expect(footerTemplate).not.toContain('<img');
  });

  describe('escaping', () => {
    it('escapes the footer title, which bypasses Handlebars entirely', () => {
      const { footerTemplate } = builder.build({
        localization: context('en'),
        title: '<script>alert(1)</script>',
      });

      expect(footerTemplate).not.toContain('<script>');
      expect(footerTemplate).toContain('&lt;script&gt;');
    });

    it('escapes page-number labels coming from the translation bundle', () => {
      const { footerTemplate } = builder.build({
        localization: context('en', { page: '"><img src=x onerror=alert(1)>' }),
        title: 'Receipt',
      });

      expect(footerTemplate).not.toContain('onerror=alert(1)>');
      expect(footerTemplate).toContain('&quot;&gt;&lt;img');
    });
  });
});

describe('escapeHtml', () => {
  it('escapes the five characters that matter in text and quoted attributes', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('escapes ampersands before the entities it introduces, so nothing double-escapes wrongly', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves ordinary text — including Arabic — untouched', () => {
    expect(escapeHtml('تقرير حادث 2026')).toBe('تقرير حادث 2026');
  });
});
