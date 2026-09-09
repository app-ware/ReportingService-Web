import { Injectable } from '@nestjs/common';
import { TemplateData } from './dto/template-data.interface';
import { ReportRenderPipeline } from 'src/common/render/report-render.pipeline';
import { ReportPayloadValidator } from 'src/common/report-contract/report-payload.validator';

@Injectable()
export class EvaluationReportsService {
  constructor(
    private readonly validator: ReportPayloadValidator,
    private readonly pipeline: ReportRenderPipeline,
  ) {}

  /**
   * Validates the assembled payload against the version-1 evaluation contract and renders it.
   *
   * Evaluation labels have two sources and the template resolves them in this order:
   * the center's own per-report `variants.label_*` text when present, then the localized
   * default. That keeps a center that configured Arabic label text in the database in
   * control of its own wording, while a report with no configured labels still renders in
   * the requested language rather than in raw English.
   */
  async createPdfFromData(rawPayload: unknown, correlationId?: string): Promise<Buffer> {
    const validated = this.validator.validate<TemplateData>('evaluation', rawPayload);

    return this.pipeline.render({
      reportType: 'evaluation',
      templatePath: 'evaluation-reports/evaluation-report.hbs',
      validated,
      correlationId,
      layout: (context, data) => ({
        format: 'A4',
        margin: { top: '25px', right: '25px', left: '25px' },
        footerTitle: context.labels.report.documentTitle ?? 'Evaluation Report',
        includeFooter: data.settings?.includeFooter,
        footerImageBase64: (data.settings as { footerImageBase64?: string | null })?.footerImageBase64,
      }),
    });
  }
}
