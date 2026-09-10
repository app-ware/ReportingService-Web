import { Injectable } from '@nestjs/common';
import { InvoiceReportTemplateData } from './dto/template-data.interface';
import { ReportRenderPipeline } from 'src/common/render/report-render.pipeline';
import { ReportPayloadValidator } from 'src/common/report-contract/report-payload.validator';

@Injectable()
export class InvoiceReportsService {
  constructor(
    private readonly validator: ReportPayloadValidator,
    private readonly pipeline: ReportRenderPipeline,
  ) {}

  /**
   * Validates the assembled payload against the version-1 invoice contract and renders it.
   *
   * Every monetary value arrives as a formatted string — fee lines, discount, VAT, total
   * and the total in words are all calculated and formatted by Nursery. The renderer
   * prints them verbatim; localizing labels must never re-derive a number.
   */
  async createPdfFromData(rawPayload: unknown, correlationId?: string): Promise<Buffer> {
    const validated = this.validator.validate<InvoiceReportTemplateData>('invoice', rawPayload);

    return this.pipeline.render({
      reportType: 'invoice',
      templatePath: 'invoice-report/invoice-report.hbs',
      validated,
      correlationId,
      layout: (context, data) => ({
        format: 'A4',
        margin: { top: '25px', right: '25px', left: '25px' },
        footerTitle: context.labels.report.footerTitle ?? 'Invoice Report',
        includeFooter: data.settings?.includeFooter,
        footerImageBase64: data.settings?.footerImageBase64,
      }),
    });
  }
}
