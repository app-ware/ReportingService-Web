import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ReportPayloadValidator } from './report-payload.validator';
import { ReportRuntimeConfig, buildReportRuntimeConfig } from 'src/config/report.config';
import { IncidentReportTemplateData } from 'src/modules/incident-report/dto/template-data.interface';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

const config: ReportRuntimeConfig = buildReportRuntimeConfig({});

function incidentPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    meta: { schemaVersion: 1, locale: 'en' },
    center: { name: 'Sunshine Nursery', address: '12 Palm St', landLine: '0100000', logoBase64: PNG },
    settings: { useImages: true, includeFooter: true, headerImageBase64: PNG, footerImageBase64: null },
    student: { name: 'Yara Hassan' },
    incident: {
      date: '26/08/2026',
      time: '7:15AM',
      title: 'Scrape / Cut',
      description: 'Grazed a knee in the yard.',
      actionsTaken: 'Cleaned and dressed the graze.',
      recommendedFollowUp: null,
      reportedByName: 'Nurse Amira',
      parentContacted: true,
      parentContactTime: '7:30AM',
    },
    ...overrides,
  };
}

function invoicePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    meta: { schemaVersion: 1, locale: 'fr' },
    center: { name: 'Sunshine Nursery', address: null, landLine: null, logoBase64: null },
    settings: { useImages: false, includeFooter: false, headerImageBase64: null, footerImageBase64: null },
    invoice: {
      invoiceNumber: 1042,
      issueDate: '01/09/2026',
      academicYearTitle: '2026/2027',
      studentId: 55,
      studentName: 'Yara Hassan',
      parentName: 'Hassan Ali',
      className: 'KG1-A',
      feeLines: [{ title: 'Tuition', amount: '10,000.00' }],
      discount: null,
      vatAmount: '1,400.00',
      total: '11,400.00',
      currencyCode: 'EGP',
      totalInWords: 'Eleven Thousand Four Hundred EGP Only',
    },
    ...overrides,
  };
}

function receiptPayload(settings: Record<string, unknown>): Record<string, unknown> {
  return {
    meta: { schemaVersion: 1, locale: 'en' },
    center: { name: 'Sunshine Nursery', address: null, landLine: null, logoBase64: null },
    settings: { useImages: false, includeFooter: false, headerImageBase64: null, footerImageBase64: null, ...settings },
    receipt: {
      receiptNumber: 7,
      date: '01/09/2026',
      parentName: null,
      studentName: 'Yara Hassan',
      invoiceNumber: null,
      description: 'Installment 1',
      amount: '2,500.00',
      currencyCode: 'EGP',
      amountInWords: 'Two Thousand Five Hundred EGP Only',
      paymentTypeTitle: 'Cash',
      paymentNote: null,
    },
  };
}

describe('ReportPayloadValidator', () => {
  let validator: ReportPayloadValidator;

  beforeEach(() => {
    validator = new ReportPayloadValidator(config);
  });

  describe('schema versioning', () => {
    it('accepts a version-1 payload and reports its metadata', () => {
      const result = validator.validate<IncidentReportTemplateData>('incident', incidentPayload());

      expect(result.meta).toEqual({ schemaVersion: 1, locale: 'en' });
      expect(result.unversioned).toBe(false);
      expect(result.locale).toBe('en');
      expect(result.payloadBytes).toBeGreaterThan(0);
    });

    it('honours the locale carried in meta', () => {
      expect(validator.validate('invoice', invoicePayload()).locale).toBe('fr');
      expect(
        validator.validate('incident', incidentPayload({ meta: { schemaVersion: 1, locale: 'ar' } })).locale,
      ).toBe('ar');
    });

    it('accepts an unversioned payload and renders it in English', () => {
      const payload = incidentPayload();
      delete payload.meta;

      const result = validator.validate('incident', payload);

      expect(result.unversioned).toBe(true);
      expect(result.locale).toBe('en');
      expect(result.meta.schemaVersion).toBe(1);
    });

    it('falls back to English for an unsupported locale rather than rejecting the render', () => {
      const result = validator.validate('incident', incidentPayload({ meta: { schemaVersion: 1, locale: 'de' } }));
      expect(result.locale).toBe('en');
    });

    it.each([0, 2, 99, '1', null])('rejects unsupported schema version %p', (schemaVersion) => {
      expect(() =>
        validator.validate('incident', incidentPayload({ meta: { schemaVersion, locale: 'en' } })),
      ).toThrow(BadRequestException);
    });

    it('names meta.schemaVersion in the rejection so the caller knows what to fix', () => {
      try {
        validator.validate('incident', incidentPayload({ meta: { schemaVersion: 2, locale: 'en' } }));
        fail('expected a BadRequestException');
      } catch (error) {
        expect((error as BadRequestException).getResponse()).toMatchObject({
          message: [{ field: 'meta.schemaVersion' }],
        });
      }
    });
  });

  describe('unknown fields', () => {
    it('strips unknown fields for version 1 instead of rejecting the payload', () => {
      const result = validator.validate<Record<string, any>>(
        'incident',
        incidentPayload({ somethingNursseryAddedLater: 'value', anotherOne: 1 }),
      );

      expect(result.strippedFieldCount).toBe(2);
      expect(result.data).not.toHaveProperty('somethingNursseryAddedLater');
      expect(result.data).not.toHaveProperty('anotherOne');
      // The known fields survive untouched.
      expect(result.data.student.name).toBe('Yara Hassan');
    });

    it('strips unknown nested fields too', () => {
      const payload = incidentPayload();
      (payload.incident as Record<string, unknown>).severityRating = 5;

      const result = validator.validate<Record<string, any>>('incident', payload);

      expect(result.data.incident).not.toHaveProperty('severityRating');
      expect(result.data.incident.title).toBe('Scrape / Cut');
    });

    it('removes `meta` from template data without counting the known envelope as unknown', () => {
      const result = validator.validate<Record<string, any>>('incident', incidentPayload());
      expect(result.data).not.toHaveProperty('meta');
      expect(result.strippedFieldCount).toBe(0);
    });
  });

  describe('required fields and types', () => {
    it('rejects a missing required nested object', () => {
      const payload = incidentPayload();
      delete payload.student;

      expect(() => validator.validate('incident', payload)).toThrow(BadRequestException);
    });

    it('rejects a missing required leaf and names its full path', () => {
      const payload = incidentPayload();
      delete (payload.incident as Record<string, unknown>).description;

      try {
        validator.validate('incident', payload);
        fail('expected a BadRequestException');
      } catch (error) {
        expect((error as BadRequestException).getResponse()).toMatchObject({
          message: [{ field: 'incident.description' }],
        });
      }
    });

    it('rejects a required field sent as null', () => {
      const payload = incidentPayload();
      (payload.student as Record<string, unknown>).name = null;

      expect(() => validator.validate('incident', payload)).toThrow(BadRequestException);
    });

    it('accepts null for a nullable field', () => {
      const result = validator.validate<Record<string, any>>('invoice', invoicePayload());
      expect(result.data.invoice.discount).toBeNull();
      expect(result.data.center.address).toBeNull();
    });

    it('rejects a wrong scalar type', () => {
      const payload = incidentPayload();
      (payload.incident as Record<string, unknown>).parentContacted = 'yes';

      expect(() => validator.validate('incident', payload)).toThrow(BadRequestException);
    });

    it('rejects a non-integer where an integer id is required', () => {
      const payload = invoicePayload();
      (payload.invoice as Record<string, unknown>).studentId = 55.5;

      expect(() => validator.validate('invoice', payload)).toThrow(BadRequestException);
    });

    it('rejects NaN and Infinity', () => {
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
        const payload = invoicePayload();
        (payload.invoice as Record<string, unknown>).studentId = value;
        expect(() => validator.validate('invoice', payload)).toThrow(BadRequestException);
      }
    });

    it('rejects an array where an object is expected', () => {
      expect(() => validator.validate('incident', incidentPayload({ student: ['Yara'] }))).toThrow(
        BadRequestException,
      );
    });

    it('rejects a non-object body', () => {
      for (const body of [null, 'a string', 42, ['array']]) {
        expect(() => validator.validate('incident', body)).toThrow(BadRequestException);
      }
    });
  });

  describe('enums', () => {
    it('accepts the two configured receipt sizes', () => {
      expect(validator.validate<Record<string, any>>('receipt', receiptPayload({ reportSize: 'A4' })).data.settings.reportSize).toBe('A4');
      expect(validator.validate<Record<string, any>>('receipt', receiptPayload({ reportSize: 'A5' })).data.settings.reportSize).toBe('A5');
    });

    it.each(['A3', 'a4', 'Letter', ''])('rejects reportSize %p', (reportSize) => {
      expect(() => validator.validate('receipt', receiptPayload({ reportSize }))).toThrow(BadRequestException);
    });
  });

  describe('size limits', () => {
    it('rejects a string over its field maximum', () => {
      const payload = incidentPayload();
      (payload.student as Record<string, unknown>).name = 'ي'.repeat(600);

      expect(() => validator.validate('incident', payload)).toThrow(BadRequestException);
    });

    it('accepts a long-but-legal Arabic name', () => {
      const payload = incidentPayload();
      const longName = 'عبد الرحمن محمد ' .repeat(10).trim();
      (payload.student as Record<string, unknown>).name = longName;

      expect(validator.validate<Record<string, any>>('incident', payload).data.student.name).toBe(longName);
    });

    it('rejects an array over its item ceiling', () => {
      const payload = invoicePayload();
      (payload.invoice as Record<string, unknown>).feeLines = Array.from({ length: 201 }, () => ({
        title: 'Fee',
        amount: '1.00',
      }));

      expect(() => validator.validate('invoice', payload)).toThrow(BadRequestException);
    });

    it('rejects a payload over the total byte ceiling with 413', () => {
      const tiny = new ReportPayloadValidator({ ...config, maxPayloadBytes: 512 });
      expect(() => tiny.validate('incident', incidentPayload())).toThrow(PayloadTooLargeException);
    });
  });

  describe('images', () => {
    it.each([
      ['a javascript: URL', 'javascript:alert(1)'],
      ['an http: URL', 'http://evil.example/logo.png'],
      ['a file: URL', 'file:///etc/passwd'],
      ['an HTML data URI', 'data:text/html;base64,PHNjcmlwdD4='],
      ['an SVG data URI', 'data:image/svg+xml;base64,PHN2Zy8+'],
    ])('rejects %s as a center logo', (_label, logoBase64) => {
      const payload = incidentPayload();
      (payload.center as Record<string, unknown>).logoBase64 = logoBase64;

      expect(() => validator.validate('incident', payload)).toThrow(BadRequestException);
    });

    it('rejects an image over the per-image ceiling', () => {
      const small = new ReportPayloadValidator({ ...config, maxImageBytes: 16 });
      const payload = incidentPayload();

      expect(() => small.validate('incident', payload)).toThrow(BadRequestException);
    });

    it('accepts a null image — a center with no logo is normal', () => {
      const payload = incidentPayload();
      (payload.center as Record<string, unknown>).logoBase64 = null;

      expect(validator.validate<Record<string, any>>('incident', payload).data.center.logoBase64).toBeNull();
    });
  });

  describe('the evaluation node tree', () => {
    const evaluationPayload = (nodes: unknown[]) => ({
      meta: { schemaVersion: 1, locale: 'ar' },
      childInfo: { name: 'يارا حسن', class: 'KG1-A', teacher: 'أميرة', age: '4 years', attendance: '150/180', dateFrom: '01/09/2025', dateTo: '30/06/2026' },
      settings: { useImages: false, includeFooter: false, headerImageBase64: null, footerImageBase64: null },
      variants: { title_background_color: '#123456', label_class: 'الصف:' },
      terms: [{ title: 'Term 1' }],
      nodes,
      legend: [{ value: 'A', text: 'Excellent' }],
      globalRemark: null,
    });

    it('validates a nested node tree', () => {
      const result = validator.validate<Record<string, any>>(
        'evaluation',
        evaluationPayload([
          {
            id: 1,
            title: 'Language',
            level: 1,
            children: [
              { id: 2, title: 'Speaking', level: 2, children: [{ id: 3, title: 'Clarity', level: 3, values: [{ value: 'A' }], children: [] }] },
            ],
          },
        ]),
      );

      expect(result.data.nodes[0].children[0].children[0].values[0].value).toBe('A');
      expect(result.locale).toBe('ar');
    });

    it('rejects a node level outside the four group levels', () => {
      expect(() =>
        validator.validate('evaluation', evaluationPayload([{ id: 1, title: 'X', level: 7, children: [] }])),
      ).toThrow(BadRequestException);
    });

    it('strips a variants key that is not on the palette allow-list', () => {
      const payload = evaluationPayload([]);
      (payload.variants as Record<string, unknown>).injected_style = 'x;background:url(http://evil)';

      const result = validator.validate<Record<string, any>>('evaluation', payload);

      expect(result.data.variants).not.toHaveProperty('injected_style');
      expect(result.data.variants.title_background_color).toBe('#123456');
    });
  });
});
