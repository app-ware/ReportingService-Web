import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import * as fs from 'fs/promises';
import * as path from 'path';

interface BundledFont {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  format: string;
  dataUri: string;
  bytes: number;
}

const FONT_FORMATS: Readonly<Record<string, { format: string; mime: string }>> = {
  '.woff2': { format: 'woff2', mime: 'font/woff2' },
  '.woff': { format: 'woff', mime: 'font/woff' },
  '.ttf': { format: 'truetype', mime: 'font/ttf' },
  '.otf': { format: 'opentype', mime: 'font/otf' },
};

/**
 * The family name templates ask for. Whatever font files are dropped into
 * `src/assets/fonts/` are registered under this one family, so the templates never need
 * to know which specific typeface a deployment approved.
 */
export const REPORT_FONT_FAMILY = 'iCareReport';

/** Used when no font is bundled — the same stack the templates shipped with. */
const FALLBACK_STACK = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

/**
 * Loads Arabic-capable report fonts from the service's own bundle.
 *
 * Fonts are read from disk once at boot and inlined into the page as base64 `@font-face`
 * sources. That is deliberate on two counts: the renderer must never fetch a font over
 * the network, and Chromium's request interception blocks `file:` too — so a `url()`
 * pointing at a local font would simply be denied. Inlining is what makes a bundled font
 * work under those rules.
 *
 * No specific typeface is required or downloaded. A deployment drops its approved,
 * licence-cleared font files into `src/assets/fonts/`; until then the service renders with
 * the system stack and logs once that Arabic coverage is unverified.
 */
@Injectable()
export class ReportFontService implements OnModuleInit {
  private fonts: BundledFont[] = [];
  private css = '';

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ReportFontService.name);
  }

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  /** The `<style>` block templates inject. Empty when nothing is bundled. */
  fontFaceCss(): string {
    return this.css;
  }

  /** The `font-family` value templates should use. */
  fontStack(): string {
    return this.fonts.length > 0 ? `"${REPORT_FONT_FAMILY}", ${FALLBACK_STACK}` : FALLBACK_STACK;
  }

  /** Family names actually loaded — telemetry and tests only. */
  loadedFamilies(): string[] {
    return this.fonts.length > 0 ? [REPORT_FONT_FAMILY] : [];
  }

  private async load(): Promise<void> {
    const fontDir = path.join(__dirname, '..', '..', 'assets', 'fonts');

    let entries: string[];
    try {
      entries = await fs.readdir(fontDir);
    } catch {
      this.logger.warn(
        { fontDir },
        'No bundled report font directory found. Falling back to the system font stack; Arabic rendering coverage is unverified until an approved font is bundled.',
      );
      return;
    }

    const loaded: BundledFont[] = [];

    for (const entry of entries.sort()) {
      const extension = path.extname(entry).toLowerCase();
      const descriptor = FONT_FORMATS[extension];
      if (!descriptor) {
        continue;
      }

      try {
        const buffer = await fs.readFile(path.join(fontDir, entry));
        loaded.push({
          family: REPORT_FONT_FAMILY,
          format: descriptor.format,
          dataUri: `data:${descriptor.mime};base64,${buffer.toString('base64')}`,
          bytes: buffer.length,
          ...this.inferFace(entry),
        });
      } catch (error) {
        this.logger.warn({ err: error, file: entry }, 'Could not read bundled font file.');
      }
    }

    if (loaded.length === 0) {
      this.logger.warn(
        { fontDir },
        'Bundled report font directory contains no usable font files. Falling back to the system font stack; Arabic rendering coverage is unverified until an approved font is bundled.',
      );
      return;
    }

    this.fonts = loaded;
    this.css = loaded
      .map(
        (font) => `@font-face{font-family:"${font.family}";font-style:${font.style};font-weight:${font.weight};font-display:block;src:url(${font.dataUri}) format("${font.format}");}`,
      )
      .join('');

    this.logger.info(
      {
        family: REPORT_FONT_FAMILY,
        faces: loaded.length,
        totalBytes: loaded.reduce((sum, font) => sum + font.bytes, 0),
      },
      'Bundled report fonts loaded.',
    );
  }

  /**
   * Weight and style come from the filename, which is how font vendors ship them
   * ("...-Bold.ttf", "...-Italic.woff2"). An unrecognised name registers as regular.
   */
  private inferFace(filename: string): { weight: number; style: 'normal' | 'italic' } {
    const name = filename.toLowerCase();
    const style: 'normal' | 'italic' = /italic|oblique/.test(name) ? 'italic' : 'normal';

    const weights: Array<[RegExp, number]> = [
      [/thin|hairline/, 100],
      [/extralight|ultralight/, 200],
      [/light/, 300],
      [/medium/, 500],
      [/semibold|demibold/, 600],
      [/extrabold|ultrabold/, 800],
      [/black|heavy/, 900],
      [/bold/, 700],
    ];

    for (const [pattern, weight] of weights) {
      if (pattern.test(name)) {
        return { weight, style };
      }
    }

    return { weight: 400, style };
  }
}
