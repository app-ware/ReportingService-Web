/**
 * The minimal rendering envelope Nursery attaches to every assembled report payload.
 *
 * Report-specific fields live alongside `meta` and are unchanged by versioning —
 * `meta` only carries what the renderer itself needs to decide *how* to render.
 */
export interface ReportMeta {
  schemaVersion: 1;
  locale: ReportLocale;
}

export const SUPPORTED_LOCALES = ['en', 'fr', 'ar'] as const;
export type ReportLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: ReportLocale = 'en';

/** Locales whose report layout must be mirrored. */
const RTL_LOCALES: ReadonlySet<ReportLocale> = new Set<ReportLocale>(['ar']);

export const CURRENT_SCHEMA_VERSION = 1 as const;

/** Every schema version this build knows how to render. */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [CURRENT_SCHEMA_VERSION];

export function isSupportedLocale(value: unknown): value is ReportLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function directionFor(locale: ReportLocale): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

/**
 * Resolves the envelope for a payload that may or may not carry one.
 *
 * Unversioned requests are a deliberate, temporary compatibility path: they render
 * in English so that ReportingService can be deployed ahead of Nursery. The path is
 * removed only once telemetry shows no production caller still uses it — there is no
 * time-based automatic removal. `unversioned` is reported so that usage is measurable.
 */
export function resolveMeta(raw: unknown): { meta: ReportMeta; unversioned: boolean } {
  const candidate = (raw as { meta?: unknown } | null | undefined)?.meta;

  if (candidate === undefined || candidate === null) {
    return { meta: { schemaVersion: CURRENT_SCHEMA_VERSION, locale: DEFAULT_LOCALE }, unversioned: true };
  }

  const { schemaVersion, locale } = candidate as { schemaVersion?: unknown; locale?: unknown };

  return {
    meta: {
      schemaVersion: schemaVersion as 1,
      locale: isSupportedLocale(locale) ? locale : DEFAULT_LOCALE,
    },
    unversioned: false,
  };
}
