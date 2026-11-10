import { Injectable } from '@nestjs/common';
import { InstallmentReportTemplateData } from './dto/template-data.interface';
import { ReportRenderPipeline } from 'src/common/render/report-render.pipeline';
import { ReportPayloadValidator } from 'src/common/report-contract/report-payload.validator';

@Injectable()
export class InstallmentReportsService {
  constructor(
    private readonly validator: ReportPayloadValidator,
    private readonly pipeline: ReportRenderPipeline,
  ) {}

  /**
   * Validates the assembled payload against the version-1 installment contract and renders it.
   *
   * One fixed geometry: the legacy slip is always an A5 landscape half sheet, and it has no
   * text footer (no render date, title or page numbers), so `textFooter` is off.
   */
  async createPdfFromData(rawPayload: unknown, correlationId?: string): Promise<Buffer> {
    const validated = this.validator.validate<InstallmentReportTemplateData>('installment', rawPayload);

    return this.pipeline.render({
      reportType: 'installment',
      templatePath: 'installment-report/installment-report.hbs',
      validated,
      correlationId,
      layout: (context) => ({
        format: 'A5',
        landscape: true,
        margin: { top: '15px', right: '15px', left: '15px' },
        footerTitle: context.labels.report.footerTitle ?? 'Installment',
        textFooter: false,
        marginBottom: '15px',
      }),
    });
  }
}
