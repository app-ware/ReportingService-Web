import { Test, TestingModule } from '@nestjs/testing';
import { SharedModule } from 'src/common/shared/shared.module';
import { ReportLocalizationService } from './report-localization.service';
import { SUPPORTED_LOCALES, directionFor, isSupportedLocale, resolveMeta } from 'src/common/report-contract/report-meta';
import { ReportType } from 'src/common/report-contract/report-schemas';

const REPORT_TYPES: ReportType[] = ['evaluation', 'incident', 'invoice', 'receipt'];

describe('ReportLocalizationService', () => {
  let moduleRef: TestingModule;
  let localization: ReportLocalizationService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [SharedModule],
      providers: [ReportLocalizationService],
    }).compile();

    localization = moduleRef.get(ReportLocalizationService);
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('supplies English labels', () => {
    const context = localization.contextFor('incident', 'en');

    expect(context.labels.report.heading).toBe('Incident Report');
    expect(context.labels.report.studentName).toBe('Student Name:');
    expect(context.labels.common.yes).toBe('Yes');
  });

  it('supplies French labels', () => {
    const context = localization.contextFor('invoice', 'fr');

    expect(context.labels.report.documentTitle).toBe('Facture');
    expect(context.labels.report.vat).toBe('TVA :');
    expect(context.labels.common.amount).toBe('Montant');
  });

  it('supplies Arabic labels', () => {
    const context = localization.contextFor('receipt', 'ar');

    expect(context.labels.report.documentTitle).toBe('سند قبض');
    expect(context.labels.report.parentSignature).toBe('توقيع ولي الأمر');
    expect(context.labels.common.currency).toBe('العملة');
  });

  it('marks Arabic as RTL and the others as LTR', () => {
    expect(localization.contextFor('incident', 'ar')).toMatchObject({ dir: 'rtl', isRtl: true });
    expect(localization.contextFor('incident', 'en')).toMatchObject({ dir: 'ltr', isRtl: false });
    expect(localization.contextFor('incident', 'fr')).toMatchObject({ dir: 'ltr', isRtl: false });
  });

  /**
   * A missing label renders as an empty cell; a missing *key* would render the literal
   * string "reports.incident.heading" into the PDF. This is the check that every locale
   * has full coverage so neither happens.
   */
  it.each(REPORT_TYPES)('has complete label coverage for %s across every locale', (reportType) => {
    const english = localization.contextFor(reportType, 'en');
    const englishKeys = Object.keys(english.labels.report).sort();

    expect(englishKeys.length).toBeGreaterThan(0);

    for (const locale of SUPPORTED_LOCALES) {
      const context = localization.contextFor(reportType, locale);

      expect(Object.keys(context.labels.report).sort()).toEqual(englishKeys);
      expect(Object.keys(context.labels.common).sort()).toEqual(Object.keys(english.labels.common).sort());

      for (const [key, value] of Object.entries(context.labels.report)) {
        expect(typeof value).toBe('string');
        expect(value.trim()).not.toBe('');
        // A leaked lookup key would contain the namespace prefix.
        expect(value).not.toContain(`reports.${reportType}.${key}`);
      }
    }
  });

  it('actually differs between locales rather than falling through to English', () => {
    const en = localization.contextFor('incident', 'en').labels.report.heading;
    const fr = localization.contextFor('incident', 'fr').labels.report.heading;
    const ar = localization.contextFor('incident', 'ar').labels.report.heading;

    expect(new Set([en, fr, ar]).size).toBe(3);
  });
});

describe('report meta helpers', () => {
  it('treats a missing meta as an unversioned English request', () => {
    expect(resolveMeta({ center: {} })).toEqual({
      meta: { schemaVersion: 1, locale: 'en' },
      unversioned: true,
    });
  });

  it('treats a null meta as unversioned', () => {
    expect(resolveMeta({ meta: null }).unversioned).toBe(true);
  });

  it('reads a supplied locale and marks the request versioned', () => {
    expect(resolveMeta({ meta: { schemaVersion: 1, locale: 'ar' } })).toEqual({
      meta: { schemaVersion: 1, locale: 'ar' },
      unversioned: false,
    });
  });

  it('defaults an unsupported locale to English while staying versioned', () => {
    expect(resolveMeta({ meta: { schemaVersion: 1, locale: 'zz' } })).toEqual({
      meta: { schemaVersion: 1, locale: 'en' },
      unversioned: false,
    });
  });

  it.each(SUPPORTED_LOCALES)('recognises %s as supported', (locale) => {
    expect(isSupportedLocale(locale)).toBe(true);
  });

  it.each(['de', 'EN', '', null, undefined, 5])('rejects %p as a locale', (value) => {
    expect(isSupportedLocale(value)).toBe(false);
  });

  it('maps only Arabic to RTL', () => {
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('en')).toBe('ltr');
    expect(directionFor('fr')).toBe('ltr');
  });
});
