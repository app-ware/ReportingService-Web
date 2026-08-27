import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { chromium, Browser, BrowserContext } from 'playwright';
import { IncidentReportTemplateData } from './dto/template-data.interface';

@Injectable()
export class IncidentReportPdfService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser;

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(IncidentReportPdfService.name);
  }

  async onModuleInit() {
    this.logger.info('Initializing Incident Report PDF Service...');
    this.browser = await chromium.launch();
    this.logger.info('Incident Report PDF Service initialized successfully');
  }

  async onModuleDestroy() {
    this.logger.info('Closing browser...');
    if (this.browser) {
      await this.browser.close();
      this.logger.info('Browser closed successfully.');
    }
  }

  private buildFooterOptions(data: IncidentReportTemplateData): { footerTemplate: string; marginBottom: string } {
    const textFooterHtml = `
    <div style="width: 100%; font-size: 9px; padding: 5px 25px 0; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eee;">
    <span style="flex: 1; text-align: left;">
      ${new Date().toLocaleDateString()}
    </span>
    <span style="flex: 1; text-align: center;">Incident Report</span>
    <span style="flex: 1; text-align: right;">
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </span>
  </div>`;

    const hasImageFooter = data.settings?.includeFooter && data.settings?.footerImageBase64;

    if (hasImageFooter) {
      return {
        footerTemplate: `
          <div style="width: 100%;">
            ${textFooterHtml}
            <div style="padding: 5px 25px 0; box-sizing: border-box;">
              <img src="${data.settings.footerImageBase64}" style="width: 100%; height: auto;" />
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

  async generatePdfFromTemplate(data: IncidentReportTemplateData): Promise<Buffer> {
    this.logger.info('Starting PDF generation...');

    const templatePath = path.join(__dirname, '..', '..', 'templates', 'incident-report', 'incident-report.hbs');
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
      this.logger.info('PDF generated successfully');

      return pdfBuffer;
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to generate PDF');
      throw new Error('Failed to generate PDF.');
    } finally {
      if (context) {
        this.logger.debug('Closing browser context...');
        await context.close();
      }
    }
  }
}
