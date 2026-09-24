import { Injectable } from '@nestjs/common';
import { PaySlipReportTemplateData } from './dto/template-data.interface';
import { ReportRenderPipeline } from 'src/common/render/report-render.pipeline';
import { ReportPayloadValidator } from 'src/common/report-contract/report-payload.validator';

@Injectable()
export class PaySlipReportsService {
  constructor(
    private readonly validator: ReportPayloadValidator,
    private readonly pipeline: ReportRenderPipeline,
  ) {}

  /**
   * Validates the assembled payload against the version-1 pay slip contract and renders it.
   *
   * Legacy only ever produced the pay slip on A4 (`PaySlipReport.rpt` /
   * `PaySlipReportCustomized.rpt`), so unlike the receipt there is no size toggle.
   */
  async createPdfFromData(rawPayload: unknown, correlationId?: string): Promise<Buffer> {
    const validated = this.validator.validate<PaySlipReportTemplateData>('payslip', rawPayload);

    return this.pipeline.render({
      reportType: 'payslip',
      templatePath: 'payslip-report/payslip-report.hbs',
      validated,
      correlationId,
      layout: (context, data) => ({
        format: 'A4',
        margin: { top: '25px', right: '25px', left: '25px' },
        footerTitle: context.labels.report.footerTitle ?? 'Pay Slip',
        includeFooter: data.settings?.includeFooter,
        footerImageBase64: data.settings?.footerImageBase64,
      }),
    });
  }
}
