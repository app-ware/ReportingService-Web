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
  landscape?: boolean;
  /** Bottom is the footer's margin, supplied separately. */
  margin: { top: string; right: string; left: string };
  /** Text shown centered in the page footer. */
  footerTitle: string;
  /** Bottom margin the text footer is drawn in; defaults to 40px. */
  marginBottom?: string;
  /**
   * Whether Chromium draws the text footer (render date, title, page n of N) on every
   * page. Defaults to true. A report whose legacy print had no such footer (the
   * installment slip) turns it off; `marginBottom` is then just the page's bottom margin.
   */
  textFooter?: boolean;
}

/** Page heights in mm, portrait. Landscape swaps to the page width. */
const PAGE_SIZE_MM: Record<ReportLayout['format'], { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
};

/**
 * The printable height of one page as a CSS length, so a template can make a short
 * report fill its page (see `.page-fill` in the shared layout styles). A few px are
 * held back so rounding never spills the closing blocks onto an empty second page.
 */
export function pageFillHeight(layout: ReportLayout, marginBottom: string): string {
  const size = PAGE_SIZE_MM[layout.format];
  const pageHeight = layout.landscape ? size.width : size.height;
  return `calc(${pageHeight}mm - ${layout.margin.top} - ${marginBottom} - 4px)`;
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

    const footer =
      layout.textFooter === false
        ? { footerTemplate: null, marginBottom: layout.marginBottom ?? '40px' }
        : this.footers.build({
            localization: context,
            title: layout.footerTitle,
            marginBottom: layout.marginBottom,
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
      pageFillHeight: pageFillHeight(layout, footer.marginBottom),
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
        landscape: layout.landscape ?? false,
        margin: { ...layout.margin, bottom: footer.marginBottom },
        footerTemplate: footer.footerTemplate,
      },
    });
  }
}
