import { validateImageDataUri } from './data-uri.util';

/** A 1x1 transparent PNG — the smallest real image we can assert against. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const VALID_PNG = `data:image/png;base64,${PNG_BASE64}`;

const ONE_MB = 1024 * 1024;

describe('validateImageDataUri', () => {
  it('accepts a base64 PNG data URI and reports its decoded size', () => {
    const result = validateImageDataUri(VALID_PNG, ONE_MB);

    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.byteLength).toBe(Buffer.from(PNG_BASE64, 'base64').length);
  });

  it.each(['image/jpeg', 'image/gif', 'image/webp', 'image/bmp'])('accepts %s', (mime) => {
    expect(validateImageDataUri(`data:${mime};base64,${PNG_BASE64}`, ONE_MB).valid).toBe(true);
  });

  it('requires a lowercase MIME type rather than coercing one', () => {
    const result = validateImageDataUri(`data:IMAGE/PNG;base64,${PNG_BASE64}`, ONE_MB);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('malformed');
  });

  describe('rejects unsafe values', () => {
    it.each([
      ['a javascript: URL', 'javascript:alert(1)'],
      ['an http: URL', 'http://example.com/logo.png'],
      ['an https: URL', 'https://example.com/logo.png'],
      ['a file: URL', 'file:///etc/passwd'],
      ['a bare path', '/var/photos/logo.png'],
      ['a non-base64 data URI', 'data:image/png,%3Cscript%3E'],
      ['a data URI with an HTML payload', `data:text/html;base64,${Buffer.from('<script>').toString('base64')}`],
    ])('rejects %s', (_label, value) => {
      expect(validateImageDataUri(value, ONE_MB).valid).toBe(false);
    });

    it('rejects SVG, which is an active document rather than a raster image', () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>').toString('base64');
      const result = validateImageDataUri(`data:image/svg+xml;base64,${svg}`, ONE_MB);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('disallowed-mime');
    });

    it('rejects a payload that is not valid base64', () => {
      // `!!!` would be silently dropped by Node's lenient decoder; re-encoding catches it.
      const result = validateImageDataUri('data:image/png;base64,AAAA!!!BBBB', ONE_MB);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('malformed');
    });

    it('rejects base64 containing whitespace or newlines', () => {
      const wrapped = `data:image/png;base64,${PNG_BASE64.slice(0, 20)}\n${PNG_BASE64.slice(20)}`;
      expect(validateImageDataUri(wrapped, ONE_MB).valid).toBe(false);
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a number', 42],
      ['an object', { src: VALID_PNG }],
    ])('rejects %s', (_label, value) => {
      const result = validateImageDataUri(value, ONE_MB);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('not-a-string');
    });

    it('rejects an empty string', () => {
      expect(validateImageDataUri('', ONE_MB).reason).toBe('empty');
    });
  });

  describe('size ceiling', () => {
    it('rejects an image over the configured byte limit', () => {
      const big = `data:image/png;base64,${Buffer.alloc(4096, 1).toString('base64')}`;
      const result = validateImageDataUri(big, 1024);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('too-large');
    });

    it('accepts an image exactly at the limit', () => {
      const bytes = Buffer.alloc(1024, 7);
      const result = validateImageDataUri(`data:image/png;base64,${bytes.toString('base64')}`, 1024);

      expect(result.valid).toBe(true);
      expect(result.byteLength).toBe(1024);
    });
  });
});
