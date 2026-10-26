import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { REPORT_RUNTIME_CONFIG, ReportRuntimeConfig } from 'src/config/report.config';
import { isValidImageDataUri } from 'src/common/report-contract/data-uri.util';
import { ReportLocale } from 'src/common/report-contract/report-meta';
import { LocalizedReportContext } from './report-localization.service';

export interface FooterInput {
  /** Localization context for the report being rendered. */
  localization: LocalizedReportContext;
  /** Footer title text — the localized report name. */
  title: string;
  /** Whether the center opted into the printable footer banner. */
  includeFooter?: boolean;
  /** Center footer banner as a base64 image data URI, if any. */
  footerImageBase64?: string | null;
  /** Falls back to the default bottom margin when no banner is rendered. */
  defaultMarginBottom?: string;
  bannerMarginBottom?: string;
}

export interface FooterOptions {
  footerTemplate: string;
  marginBottom: string;
}

/**
 * Builds Chromium's `footerTemplate`, which is the one place in the renderer where HTML
 * is assembled by string concatenation rather than by Handlebars.
 *
 * Chromium's header/footer templates are not part of the page — they are a separate
 * snippet with no Handlebars pass over them — so every interpolated value is escaped
 * here by hand, and the footer image is re-validated as a safe data URI before it is
 * embedded. Handlebars has already escaped the page body; this closes the same hole on
 * the footer path.
 */
@Injectable()
export class ReportFooterBuilder {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(REPORT_RUNTIME_CONFIG) private readonly config: ReportRuntimeConfig,
  ) {
    this.logger.setContext(ReportFooterBuilder.name);
  }

  build(input: FooterInput): FooterOptions {
    const { localization } = input;
    const dir = localization.dir;
    const startEdge = localization.isRtl ? 'right' : 'left';
    const endEdge = localization.isRtl ? 'left' : 'right';

    const pageLabel = escapeHtml(localization.labels.common.page ?? 'Page');
    const ofLabel = escapeHtml(localization.labels.common.of ?? 'of');

    const textFooterHtml = `
    <div dir="${dir}" style="width: 100%; font-size: 9px; padding: 5px 25px 0; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eee;">
    <span style="flex: 1; text-align: ${startEdge};">
      ${escapeHtml(this.renderedOnDate(localization.locale))}
    </span>
    <span style="flex: 1; text-align: center;">${escapeHtml(input.title)}</span>
    <span style="flex: 1; text-align: ${endEdge};">
      ${pageLabel} <span class="pageNumber"></span> ${ofLabel} <span class="totalPages"></span>
    </span>
  </div>`;

    const defaultMarginBottom = input.defaultMarginBottom ?? '40px';
    const bannerMarginBottom = input.bannerMarginBottom ?? '140px';

    if (!input.includeFooter || !input.footerImageBase64) {
      return { footerTemplate: textFooterHtml, marginBottom: defaultMarginBottom };
    }

    // Defense in depth: the payload validator already rejected unsafe data URIs, but the
    // footer is the one value that bypasses Handlebars, so it is checked again here.
    if (!isValidImageDataUri(input.footerImageBase64, this.config.maxImageBytes)) {
      this.logger.warn('Footer banner rejected as an unsafe or oversized data URI; rendering the text footer only.');
      return { footerTemplate: textFooterHtml, marginBottom: defaultMarginBottom };
    }

    return {
      footerTemplate: `
          <div dir="${dir}" style="width: 100%;">
            ${textFooterHtml}
            <div style="padding: 5px 25px 0; box-sizing: border-box;">
              <img src="${input.footerImageBase64}" style="width: 100%; height: auto;" />
            </div>
          </div>`,
      marginBottom: bannerMarginBottom,
    };
  }

  /**
   * The render date, in the locale's own calendar conventions. This is renderer
   * chrome — the date the document was produced — not a business value, so unlike the
   * report's own dates it is formatted here rather than by Nursery.
   */
  private renderedOnDate(locale: ReportLocale): string {
    try {
      return new Date().toLocaleDateString(locale === 'ar' ? 'ar' : locale);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }
}

/**
 * Escapes the five characters that matter in an HTML text node or a quoted attribute.
 * Kept local and explicit: the footer is not Handlebars-rendered, so it has no other
 * escaping to rely on.
 */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
