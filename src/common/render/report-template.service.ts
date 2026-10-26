import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as handlebars from 'handlebars';

/**
 * Compiles and caches the report Handlebars templates.
 *
 * Two rules hold across every template and are the reason this is centralized:
 *
 * 1. Escaping stays on. Templates use `{{value}}` only — never `{{{value}}}` — so
 *    Nursery-supplied text (a student name, an incident description a nurse typed)
 *    cannot introduce markup. There is no helper here that emits raw HTML, and
 *    `SafeString` is never produced from payload data.
 * 2. Templates are compiled once and cached. A report render should not re-read and
 *    re-parse its template on every request.
 */
@Injectable()
export class ReportTemplateService implements OnModuleInit {
  private readonly cache = new Map<string, handlebars.TemplateDelegate>();
  private readonly handlebars = handlebars.create();

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ReportTemplateService.name);
  }

  async onModuleInit(): Promise<void> {
    this.registerHelpers();
    await this.registerPartials();
  }

  private get templateRoot(): string {
    return path.join(__dirname, '..', '..', 'templates');
  }

  private registerHelpers(): void {
    this.handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    this.handlebars.registerHelper('add', (a: number, b: number) => Number(a) + Number(b));

    /**
     * First non-empty string. Used so a center-configured label from the payload wins,
     * with the localized default filling in when the payload has none.
     */
    this.handlebars.registerHelper('label', (...args: unknown[]) => {
      // Handlebars passes its options object last; it is not a candidate value.
      for (const candidate of args.slice(0, -1)) {
        if (typeof candidate === 'string' && candidate.trim() !== '') {
          return candidate;
        }
      }
      return '';
    });

    this.handlebars.registerHelper('lookup', (obj: Record<string, unknown> | null, field: string) =>
      obj?.[field],
    );
  }

  private async registerPartials(): Promise<void> {
    // The evaluation node partial recurses into itself, so it has to be registered by name.
    const nodePartial = path.join(this.templateRoot, 'evaluation-reports', 'node.hbs');

    try {
      this.handlebars.registerPartial('node', await fs.readFile(nodePartial, 'utf-8'));
      this.logger.debug('Report template partials registered.');
    } catch (error) {
      this.logger.error({ err: error, path: nodePartial }, 'Failed to register report template partial.');
      throw error;
    }
  }

  /**
   * Renders a template by its path relative to `src/templates`.
   *
   * @param relativePath e.g. `incident-report/incident-report.hbs`
   */
  async render(relativePath: string, data: unknown): Promise<string> {
    let template = this.cache.get(relativePath);

    if (!template) {
      const source = await fs.readFile(path.join(this.templateRoot, relativePath), 'utf-8');
      template = this.handlebars.compile(source);
      this.cache.set(relativePath, template);
    }

    return template(data);
  }
}
