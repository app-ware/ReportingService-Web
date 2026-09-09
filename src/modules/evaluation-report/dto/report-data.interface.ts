/**
 * The center's per-report evaluation form configuration: the label wording it chose and
 * the palette its section headers use.
 *
 * Fields are optional because the renderer treats every one of them as a *preference*:
 * a label that is absent falls back to the localized default, and a colour that is absent
 * falls back to the template's own styling. The runtime allow-list for these keys lives in
 * `report-schemas.ts` — anything not named there is stripped before rendering, because
 * every value here is interpolated into a heading or an inline `style` attribute.
 *
 * The DB-row interfaces that used to live alongside this one (`PrintableReportSettings`,
 * `EvaluationReportLegend`) are gone: they described stored-procedure recordsets that only
 * the removed in-renderer database code ever read. Nursery owns those queries now and
 * sends this service an assembled payload.
 */
export interface EvaluationReportPrintingVariants {
  show_attendance?: boolean | null;
  show_age?: boolean | null;
  show_teacher?: boolean | null;

  label_student_name?: string | null;
  label_class?: string | null;
  label_age?: string | null;
  label_from?: string | null;
  label_to?: string | null;
  label_attendance?: string | null;
  label_teacher?: string | null;
  label_legend?: string | null;
  label_remark_global?: string | null;
  label_remark_node?: string | null;

  title_text_color?: string | null;
  title_background_color?: string | null;
  subtitle1_text_color?: string | null;
  subtitle1_background_color?: string | null;
  subtitle2_text_color?: string | null;
  subtitle2_background_color?: string | null;
}
