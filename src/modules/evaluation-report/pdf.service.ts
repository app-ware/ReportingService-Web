import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { chromium, Browser, BrowserContext } from 'playwright';

type ReportData = {
  settings?: {
    footerImageBase64?: string | null;
    includeFooter?: boolean;
    useImages?: boolean;
    headerImageBase64?: string | null;
  }
};

@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser;

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(PdfService.name);
  }
  

  async onModuleInit() {
    this.logger.info('Initializing PDF Service...');
    this.browser = await chromium.launch();
    await this.registerHandlebarsHelpers();
    this.logger.info('PDF Service initialized successfully');
  }

  async onModuleDestroy() {
    this.logger.info('Closing browser...');
    if (this.browser) {
      await this.browser.close();
      this.logger.info('Browser closed successfully.');
    }
  }

  private async registerHandlebarsHelpers() {
    this.logger.debug('Registering Handlebars helpers and partials...');
    handlebars.registerHelper('eq', (a, b) => a === b);
    handlebars.registerHelper('add', (a, b) => a + b);
    handlebars.registerHelper('lookup', (obj, field) => obj?.[field]);

    const partialPath = path.join(process.cwd(), 'src', 'templates', 'evaluation-reports', 'node.hbs');
    const partialTemplate = await fs.readFile(partialPath, 'utf-8');
    handlebars.registerPartial('node', partialTemplate);
    this.logger.debug('Handlebars partials registered.');
  }

  /**
   * 2. The dedicated helper function for footer logic is restored for clarity (SRP).
   */
  private buildFooterOptions(data: ReportData): { footerTemplate: string; marginBottom: string } {
    const textFooterHtml = `
      <div style="width: 100%; font-size: 9px; padding: 5px 25px 0; box-sizing: border-box; display: flex; justify-content: space-between; border-top: 1px solid #eee;">
        <span>Evaluation Report</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`;

    const hasImageFooter = data.settings?.includeFooter && data.settings?.footerImageBase64;

    if (hasImageFooter) {
      return {
        footerTemplate: `
          <div style="width: 100%;">
            ${textFooterHtml}
            <div style="padding: 5px 25px 0; box-sizing: border-box;">
              <img src="${data.settings!.footerImageBase64}" style="width: 100%; height: auto;" />
            </div>
          </div>`,
        marginBottom: '140px',
      };
    } else {
      return {
        footerTemplate: textFooterHtml,
        marginBottom: '40px',
      };
    }
  }

  async generatePdfFromTemplate<T extends ReportData>(data: T): Promise<Buffer> {
    this.logger.info('Starting PDF generation...');
    
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'evaluation-reports', 'evaluation-report.hbs');
    
    // Use an isolated browser context for each PDF generation.
    let context: BrowserContext | undefined;

    try {
      const htmlTemplate = await fs.readFile(templatePath, 'utf-8');
      const template = handlebars.compile(htmlTemplate);
      const finalHtml = template(data);

      const { footerTemplate, marginBottom } = this.buildFooterOptions(data);

      const pdfOptions = {
        format: 'A4' as const,
        printBackground: true,
        margin: { top: '25px', right: '25px', bottom: marginBottom, left: '25px' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: footerTemplate,
      };

      this.logger.debug('PDF options configured');
      
      context = await this.browser.newContext();
      const page = await context.newPage();
      await page.setContent(finalHtml, { waitUntil: 'networkidle' });
      
      const pdfBuffer = await page.pdf(pdfOptions);
      this.logger.info('PDF generated successfully ');
      
      return pdfBuffer;
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to generate PDF ');
      throw new Error('Failed to generate PDF.');
    } finally {
      if (context) {
        this.logger.debug('Closing browser context...');
        await context.close();
      }
    }
  }
}