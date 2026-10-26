import { buildReportRuntimeConfig } from './report.config';

describe('buildReportRuntimeConfig', () => {
  it('returns conservative defaults when nothing is configured', () => {
    const config = buildReportRuntimeConfig({});

    expect(config).toEqual({
      renderTimeoutMs: 20_000,
      maxConcurrentRenders: 2,
      maxQueueDepth: 10,
      queueTimeoutMs: 10_000,
      maxPayloadBytes: 5 * 1024 * 1024,
      maxImageBytes: 2 * 1024 * 1024,
    });
  });

  it('reads every knob from the environment', () => {
    const config = buildReportRuntimeConfig({
      REPORT_RENDER_TIMEOUT_MS: '30000',
      REPORT_MAX_CONCURRENT_RENDERS: '4',
      REPORT_MAX_QUEUE_DEPTH: '25',
      REPORT_QUEUE_TIMEOUT_MS: '15000',
      REPORT_MAX_PAYLOAD_BYTES: '8388608',
      REPORT_MAX_IMAGE_BYTES: '1048576',
    });

    expect(config).toEqual({
      renderTimeoutMs: 30_000,
      maxConcurrentRenders: 4,
      maxQueueDepth: 25,
      queueTimeoutMs: 15_000,
      maxPayloadBytes: 8 * 1024 * 1024,
      maxImageBytes: 1024 * 1024,
    });
  });

  it('tolerates surrounding whitespace', () => {
    expect(buildReportRuntimeConfig({ REPORT_MAX_CONCURRENT_RENDERS: '  3  ' }).maxConcurrentRenders).toBe(3);
  });

  it.each([['an empty string', ''], ['whitespace', '   '], ['a non-number', 'lots'], ['undefined', undefined]])(
    'falls back to the default for %s',
    (_label, value) => {
      expect(buildReportRuntimeConfig({ REPORT_RENDER_TIMEOUT_MS: value }).renderTimeoutMs).toBe(20_000);
    },
  );

  describe('bounds', () => {
    it('clamps a value below the minimum rather than disabling the protection', () => {
      // A zero timeout would make every render fail; a zero concurrency would deadlock.
      expect(buildReportRuntimeConfig({ REPORT_RENDER_TIMEOUT_MS: '0' }).renderTimeoutMs).toBe(1_000);
      expect(buildReportRuntimeConfig({ REPORT_MAX_CONCURRENT_RENDERS: '0' }).maxConcurrentRenders).toBe(1);
      expect(buildReportRuntimeConfig({ REPORT_MAX_CONCURRENT_RENDERS: '-5' }).maxConcurrentRenders).toBe(1);
    });

    it('clamps a value above the maximum', () => {
      expect(buildReportRuntimeConfig({ REPORT_RENDER_TIMEOUT_MS: '999999' }).renderTimeoutMs).toBe(120_000);
      expect(buildReportRuntimeConfig({ REPORT_MAX_CONCURRENT_RENDERS: '5000' }).maxConcurrentRenders).toBe(32);
    });

    it('allows a queue depth of zero, which means "never queue, shed immediately"', () => {
      expect(buildReportRuntimeConfig({ REPORT_MAX_QUEUE_DEPTH: '0' }).maxQueueDepth).toBe(0);
    });

    it('truncates a fractional value', () => {
      expect(buildReportRuntimeConfig({ REPORT_MAX_CONCURRENT_RENDERS: '2.9' }).maxConcurrentRenders).toBe(2);
    });
  });
});
