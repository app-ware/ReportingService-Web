import { Injectable } from '@nestjs/common';
import { IncidentReportTemplateData } from './dto/template-data.interface';
import { ReportRenderPipeline } from 'src/common/render/report-render.pipeline';
import { ReportPayloadValidator } from 'src/common/report-contract/report-payload.validator';

@Injectable()
export class IncidentReportsService {
  constructor(
    private readonly validator: ReportPayloadValidator,
    private readonly pipeline: ReportRenderPipeline,
  ) {}

  /**
   * Validates the assembled payload against the version-1 incident contract and renders it.
   *
   * The payload arrives presentation-ready — Nursery owns the ownership checks, the date
   * and time display formats and the branding fallbacks. This service only decides how the
   * document is laid out and in which language its labels are printed.
   */
  async createPdfFromData(rawPayload: unknown, correlationId?: string): Promise<Buffer> {
    const validated = this.validator.validate<IncidentReportTemplateData>('incident', rawPayload);

    return this.pipeline.render({
      reportType: 'incident',
      templatePath: 'incident-report/incident-report.hbs',
      validated,
      correlationId,
      layout: (context, data) => ({
        format: 'A4',
        margin: { top: '25px', right: '25px', left: '25px' },
        footerTitle: context.labels.report.documentTitle ?? 'Incident Report',
        includeFooter: data.settings?.includeFooter,
        footerImageBase64: data.settings?.footerImageBase64,
      }),
    });
  }
}
