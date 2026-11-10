import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ReportLocale } from 'src/common/report-contract/report-meta';
import { LocalizedReportContext } from './report-localization.service';

export interface FooterInput {
  /** Localization context for the report being rendered. */
  localization: LocalizedReportContext;
  /** Footer title text — the localized report name. */
  title: string;
  /** Bottom page margin the footer is drawn in. */
  marginBottom?: string;
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
 * here by hand. Handlebars has already escaped the page body; this closes the same hole
 * on the footer path.
 *
 * The center's footer banner is not drawn here: Chromium repeats this template on every
 * page and reserves its margin on every page, so the banner is printed once at the end
 * of the document by the `report-footer-banner` partial instead.
 */
@Injectable()
export class ReportFooterBuilder {
  constructor(private readonly logger: PinoLogger) {
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

    return { footerTemplate: textFooterHtml, marginBottom: input.marginBottom ?? '40px' };
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
