/**
 * Data-URI validation for the only untrusted-shaped values in a report payload:
 * the center logo and the printable header/footer banners.
 *
 * Every one of these reaches a template `src=""` and — for the footer — is
 * interpolated into a Chromium footer template string, so it must be proven to be
 * a base64 image data URI before it goes anywhere near HTML. Anything else
 * (`javascript:`, `http:`, `file:`, an SVG carrying script, a malformed base64
 * body) is rejected rather than sanitized, because there is no legitimate caller
 * that produces those.
 */

/** Raster formats only — SVG is excluded on purpose: it is an active document. */
const ALLOWED_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

/**
 * `data:<mime>;base64,<payload>`. Anchored at both ends and deliberately strict:
 * no parameters beyond `;base64`, and no whitespace anywhere in the payload.
 */
const DATA_URI_PATTERN = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

export type DataUriRejectionReason =
  | 'not-a-string'
  | 'malformed'
  | 'disallowed-mime'
  | 'invalid-base64'
  | 'too-large'
  | 'empty';

export interface DataUriValidation {
  valid: boolean;
  reason?: DataUriRejectionReason;
  mimeType?: string;
  /** Decoded size in bytes — reported so callers can log a size without logging the image. */
  byteLength?: number;
}

/**
 * Validates one image data URI against the allow-list and a byte ceiling.
 *
 * Returns a reason rather than throwing so callers can decide between rejecting the
 * request (an unsafe value) and dropping the image (a merely oversized banner) —
 * the branding fallback rules stay with the caller.
 */
export function validateImageDataUri(value: unknown, maxBytes: number): DataUriValidation {
  if (typeof value !== 'string') {
    return { valid: false, reason: 'not-a-string' };
  }
  if (value.length === 0) {
    return { valid: false, reason: 'empty' };
  }

  const match = DATA_URI_PATTERN.exec(value);
  if (!match) {
    return { valid: false, reason: 'malformed' };
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return { valid: false, reason: 'disallowed-mime', mimeType };
  }

  const base64Body = match[2];

  // Cheap length check first so an oversized payload is rejected without decoding it.
  // Padding has to be subtracted or the estimate overshoots by up to two bytes, which
  // would reject an image sitting exactly on the limit.
  const padding = base64Body.endsWith('==') ? 2 : base64Body.endsWith('=') ? 1 : 0;
  const approximateBytes = (base64Body.length / 4) * 3 - padding;
  if (approximateBytes > maxBytes) {
    return { valid: false, reason: 'too-large', mimeType, byteLength: approximateBytes };
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(base64Body, 'base64');
  } catch {
    return { valid: false, reason: 'invalid-base64', mimeType };
  }

  // Node's base64 decoder is lenient: it silently drops invalid characters rather than
  // throwing. Re-encoding and comparing is what actually proves the body was valid base64.
  if (decoded.length === 0 || decoded.toString('base64').replace(/=+$/, '') !== base64Body.replace(/=+$/, '')) {
    return { valid: false, reason: 'invalid-base64', mimeType };
  }

  if (decoded.length > maxBytes) {
    return { valid: false, reason: 'too-large', mimeType, byteLength: decoded.length };
  }

  return { valid: true, mimeType, byteLength: decoded.length };
}

export function isValidImageDataUri(value: unknown, maxBytes: number): boolean {
  return validateImageDataUri(value, maxBytes).valid;
}
