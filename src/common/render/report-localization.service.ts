import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DEFAULT_LOCALE, ReportLocale, directionFor } from 'src/common/report-contract/report-meta';
import { ReportType } from 'src/common/report-contract/report-schemas';

export interface ReportLabels {
  /** Labels shared by every report — page numbering, yes/no, "Phone". */
  common: Record<string, string>;
  /** Labels for the report being rendered, e.g. `labels.report.incidentDate`. */
  report: Record<string, string>;
}

export interface LocalizedReportContext {
  locale: ReportLocale;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  labels: ReportLabels;
}

/**
 * Supplies translated report labels, `lang` and `dir` from the service's existing
 * `nestjs-i18n` resources (`src/i18n/<locale>/reports.json`).
 *
 * Only *labels* are localized here. Every value the reader sees — dates, amounts,
 * amounts in words, student and center names, calculated totals — is assembled and
 * formatted by Nursery and passed through untouched; the renderer localizing those too
 * would give one number two owners.
 */
@Injectable()
export class ReportLocalizationService {
  constructor(private readonly i18n: I18nService) {}

  contextFor(reportType: ReportType, locale: ReportLocale): LocalizedReportContext {
    return {
      locale,
      dir: directionFor(locale),
      isRtl: directionFor(locale) === 'rtl',
      labels: {
        common: this.bundle('reports.common', locale),
        report: this.bundle(`reports.${reportType}`, locale),
      },
    };
  }

  /**
   * Reads one namespace as a flat string map.
   *
   * `nestjs-i18n` returns the whole subtree for a namespace key, so a single lookup
   * yields every label for a report. A missing namespace falls back to English rather
   * than to raw keys — a report with English labels is usable, one full of
   * `reports.incident.title` is not.
   */
  private bundle(namespace: string, locale: ReportLocale): Record<string, string> {
    const translated = this.read(namespace, locale);
    if (translated) {
      return translated;
    }

    if (locale !== DEFAULT_LOCALE) {
      return this.read(namespace, DEFAULT_LOCALE) ?? {};
    }
    return {};
  }

  private read(namespace: string, locale: ReportLocale): Record<string, string> | null {
    try {
      const value = this.i18n.translate(namespace, { lang: locale });

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const entries = Object.entries(value as Record<string, unknown>).filter(
          ([, label]) => typeof label === 'string',
        ) as Array<[string, string]>;

        return entries.length > 0 ? Object.fromEntries(entries) : null;
      }
      return null;
    } catch {
      return null;
    }
  }
}
