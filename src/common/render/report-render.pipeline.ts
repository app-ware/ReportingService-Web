import { Injectable } from '@nestjs/common';
import { PdfRendererService } from './pdf-renderer.service';
import { ReportTemplateService } from './report-template.service';
import { ReportFontService } from './report-font.service';
import { ReportFooterBuilder } from './report-footer.builder';
import { LocalizedReportContext, ReportLocalizationService } from './report-localization.service';
import { ValidatedReportPayload } from 'src/common/report-contract/report-payload.validator';
import { ReportType } from 'src/common/report-contract/report-schemas';

export interface ReportLayout {
  format: 'A4' | 'A5';
  /** Bottom is supplied by the footer builder, since the banner decides it. */
  margin: { top: string; right: string; left: string };
  /** Text shown centered in the page footer. */
  footerTitle: string;
  includeFooter?: boolean;
  footerImageBase64?: string | null;
  defaultMarginBottom?: string;
  bannerMarginBottom?: string;
}

export interface PipelineInput<T> {
  reportType: ReportType;
  /** Template path relative to `src/templates`. */
  templatePath: string;
  validated: ValidatedReportPayload<T>;
  correlationId?: string;
  /** Page geometry and footer choices, derived from the validated payload. */
  layout: (context: LocalizedReportContext, data: T) => ReportLayout;
}

/**
 * The render path every report shares: resolve localization, build the template context,
 * render HTML, build the footer, hand the result to the bounded renderer.
 *
 * Each report module keeps its own controller, service and template — only the
 * mechanics that were previously copy-pasted four times live here.
 */
@Injectable()
export class ReportRenderPipeline {
  constructor(
    private readonly localization: ReportLocalizationService,
    private readonly templates: ReportTemplateService,
    private readonly fonts: ReportFontService,
    private readonly footers: ReportFooterBuilder,
    private readonly renderer: PdfRendererService,
  ) {}

  async render<T extends object>(input: PipelineInput<T>): Promise<Buffer> {
    const { validated } = input;
    const context = this.localization.contextFor(input.reportType, validated.locale);
    const layout = input.layout(context, validated.data);

    const footer = this.footers.build({
      localization: context,
      title: layout.footerTitle,
      includeFooter: layout.includeFooter,
      footerImageBase64: layout.footerImageBase64,
      defaultMarginBottom: layout.defaultMarginBottom,
      bannerMarginBottom: layout.bannerMarginBottom,
    });

    const html = await this.templates.render(input.templatePath, {
      ...validated.data,
      // Rendering context, kept under distinct keys so it cannot collide with a payload
      // field. `fontFaceCss` is the only value templates emit unescaped, and it is
      // service-generated from bundled files — never payload data.
      lang: context.locale,
      dir: context.dir,
      isRtl: context.isRtl,
      labels: context.labels,
      fontFaceCss: this.fonts.fontFaceCss(),
      fontStack: this.fonts.fontStack(),
    });

    return this.renderer.render({
      reportType: input.reportType,
      locale: validated.locale,
      schemaVersion: validated.meta.schemaVersion,
      unversioned: validated.unversioned,
      payloadBytes: validated.payloadBytes,
      strippedFieldCount: validated.strippedFieldCount,
      correlationId: input.correlationId,
      html,
      pdf: {
        format: layout.format,
        margin: { ...layout.margin, bottom: footer.marginBottom },
        footerTemplate: footer.footerTemplate,
      },
    });
  }
}
