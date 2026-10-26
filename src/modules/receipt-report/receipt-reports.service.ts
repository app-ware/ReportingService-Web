import { Injectable } from '@nestjs/common';
import { ReceiptReportTemplateData } from './dto/template-data.interface';
import { ReportRenderPipeline } from 'src/common/render/report-render.pipeline';
import { ReportPayloadValidator } from 'src/common/report-contract/report-payload.validator';

@Injectable()
export class ReceiptReportsService {
  constructor(
    private readonly validator: ReportPayloadValidator,
    private readonly pipeline: ReportRenderPipeline,
  ) {}

  /**
   * Validates the assembled payload against the version-1 receipt contract and renders it.
   *
   * The receipt is the one report with two page geometries: centers configure A4 or A5 in
   * `Center_Printable_Report_Sizes`, and Nursery resolves that into `settings.reportSize`.
   * The compact layout tightens margins and drops the footer banner allowance.
   */
  async createPdfFromData(rawPayload: unknown, correlationId?: string): Promise<Buffer> {
    const validated = this.validator.validate<ReceiptReportTemplateData>('receipt', rawPayload);

    return this.pipeline.render({
      reportType: 'receipt',
      templatePath: 'receipt-report/receipt-report.hbs',
      validated,
      correlationId,
      layout: (context, data) => {
        const isCompact = data.settings?.reportSize === 'A5';

        return {
          format: isCompact ? 'A5' : 'A4',
          margin: isCompact
            ? { top: '15px', right: '15px', left: '15px' }
            : { top: '25px', right: '25px', left: '25px' },
          footerTitle: context.labels.report.footerTitle ?? 'Receipt',
          // A5 has no room for a banner footer, so it keeps the text footer and a tight margin.
          includeFooter: isCompact ? false : data.settings?.includeFooter,
          footerImageBase64: isCompact ? null : data.settings?.footerImageBase64,
          defaultMarginBottom: isCompact ? '30px' : '40px',
        };
      },
    });
  }
}
