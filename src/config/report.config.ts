/**
 * Runtime knobs for the four PDF report flows.
 *
 * Every value is environment-overridable and the defaults here are deliberately
 * conservative deployment defaults — final production values are meant to be
 * determined through bounded staging load tests. The one hard invariant is that
 * Nursery's downstream HTTP timeout must stay *above* RENDER_TIMEOUT_MS by a
 * small transport margin, so that a slow render surfaces as a renderer timeout
 * (504-mapped) rather than a client-side abort.
 */
export interface ReportRuntimeConfig {
  /** Hard ceiling on a single HTML -> PDF render, in milliseconds. */
  renderTimeoutMs: number;
  /** How many renders may hold a browser context at the same time. */
  maxConcurrentRenders: number;
  /** How many renders may wait for a slot before we shed load with 503. */
  maxQueueDepth: number;
  /** How long a queued render may wait before it is rejected as busy. */
  queueTimeoutMs: number;
  /** Ceiling on the assembled request payload, in bytes. */
  maxPayloadBytes: number;
  /** Ceiling on any single decoded image (logo/header/footer), in bytes. */
  maxImageBytes: number;
}

const DEFAULTS: ReportRuntimeConfig = {
  renderTimeoutMs: 20_000,
  maxConcurrentRenders: 2,
  maxQueueDepth: 10,
  queueTimeoutMs: 10_000,
  maxPayloadBytes: 5 * 1024 * 1024,
  maxImageBytes: 2 * 1024 * 1024,
};

/** Bounds that keep a typo in the environment from disabling a protection outright. */
const BOUNDS: Record<keyof ReportRuntimeConfig, { min: number; max: number }> = {
  renderTimeoutMs: { min: 1_000, max: 120_000 },
  maxConcurrentRenders: { min: 1, max: 32 },
  maxQueueDepth: { min: 0, max: 1_000 },
  queueTimeoutMs: { min: 500, max: 120_000 },
  maxPayloadBytes: { min: 64 * 1024, max: 64 * 1024 * 1024 },
  maxImageBytes: { min: 16 * 1024, max: 32 * 1024 * 1024 },
};

function readNumber(
  key: keyof ReportRuntimeConfig,
  envName: string,
  env: NodeJS.ProcessEnv,
): number {
  const raw = env[envName];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULTS[key];
  }

  const parsed = Number(String(raw).trim());
  if (!Number.isFinite(parsed)) {
    return DEFAULTS[key];
  }

  const { min, max } = BOUNDS[key];
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export const REPORT_RUNTIME_CONFIG = 'REPORT_RUNTIME_CONFIG';

export function buildReportRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ReportRuntimeConfig {
  return {
    renderTimeoutMs: readNumber('renderTimeoutMs', 'REPORT_RENDER_TIMEOUT_MS', env),
    maxConcurrentRenders: readNumber('maxConcurrentRenders', 'REPORT_MAX_CONCURRENT_RENDERS', env),
    maxQueueDepth: readNumber('maxQueueDepth', 'REPORT_MAX_QUEUE_DEPTH', env),
    queueTimeoutMs: readNumber('queueTimeoutMs', 'REPORT_QUEUE_TIMEOUT_MS', env),
    maxPayloadBytes: readNumber('maxPayloadBytes', 'REPORT_MAX_PAYLOAD_BYTES', env),
    maxImageBytes: readNumber('maxImageBytes', 'REPORT_MAX_IMAGE_BYTES', env),
  };
}
