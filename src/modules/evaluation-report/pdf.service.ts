// import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// import * as fs from 'fs/promises';
// import * as path from 'path';
// import * as handlebars from 'handlebars';
// import { chromium, Browser, Page, PDFOptions } from 'playwright';


// @Injectable()
// export class PdfService implements OnModuleInit, OnModuleDestroy {
//   private browser: Browser;

//   async onModuleInit() {
//     this.browser = await chromium.launch();
//     await this.registerHandlebarsHelpers();
//   }

//   async onModuleDestroy() {
//     if (this.browser) {
//       await this.browser.close();
//     }
//   }

//   private async registerHandlebarsHelpers() {
//     handlebars.registerHelper('eq', (a, b) => a === b);
//     handlebars.registerHelper('add', (a, b) => a + b);
//     handlebars.registerHelper('lookup', (obj, field) => obj?.[field]);

//     const partialPath = path.join(process.cwd(), 'src', 'templates', 'evaluation-reports', 'partials', 'node.hbs',);
//     const partialTemplate = await fs.readFile(partialPath, 'utf-8');
//     handlebars.registerPartial('node', partialTemplate);
//   }

//   async generatePdfFromTemplate<T extends { settings?: { footerImageBase64?: string | null, includeFooter?: boolean } }>
//   (data: T): Promise<Buffer> {
//     const templatePath = path.join(process.cwd(), 'src', 'templates', 'evaluation-reports', 'evaluation-report.hbs');
//     const htmlTemplate = await fs.readFile(templatePath, 'utf-8');

//     const template = handlebars.compile(htmlTemplate);
//     const finalHtml = template(data);

//     // let footerTemplate = '<div></div>'; // Default empty footer
//     // if (data.settings?.includeFooter && data.settings?.footerImageBase64) {
//     //   footerTemplate = `
//     //             <div style="width: 100%; padding: 0 25px; box-sizing: border-box;">
//     //                 <img src="${data.settings.footerImageBase64}" style="width: 100%; height: auto;" />
//     //             </div>
//     //         `;
//     // }

//     let page: Page | undefined;
//     try {
//       page = await this.browser.newPage();
//       await page.setContent(finalHtml, { waitUntil: 'networkidle' });
//       // const pdfBuffer = await page.pdf({
//       //   format: 'A4',
//       //   printBackground: true,
//       //   margin: { top: '25px', right: '25px', bottom: '25px', left: '25px' },
//       // });

//               const pdfBuffer = await page.pdf({
//             format: 'A4',
//             printBackground: true,
//             // 1. INCREASE margins to make space
//             margin: { top: '100px', right: '25px', bottom: '100px', left: '25px' },
//             // 2. ENABLE header/footer display
//             displayHeaderFooter: true,
//             // 3. PASS the footer template
//             // footerTemplate: footerTemplate,
//             // Keep header template empty as it's in the main HTML
//             headerTemplate: '<div></div>' 
//         });

//       return pdfBuffer;
//     } catch (error) {
//       console.error('Error generating PDF:', error);
//       throw new Error('Failed to generate PDF.');
//     } finally {
//       if (page) await page.close();
//     }
//   }
// }
// //#endregion




//#region 1

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { chromium, Browser, Page } from 'playwright';


@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser;

  async onModuleInit() {
    this.browser = await chromium.launch();
    await this.registerHandlebarsHelpers();
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private async registerHandlebarsHelpers() {
    handlebars.registerHelper('eq', (a, b) => a === b);
    handlebars.registerHelper('add', (a, b) => a + b);
    handlebars.registerHelper('lookup', (obj, field) => obj?.[field]);

    const partialPath = path.join(process.cwd(), 'src', 'templates', 'evaluation-reports', 'partials', 'node.hbs',);
    const partialTemplate = await fs.readFile(partialPath, 'utf-8');
    handlebars.registerPartial('node', partialTemplate);
  }

  // async generatePdfFromTemplate<T extends { settings?: { footerImageBase64?: string | null, includeFooter?: boolean } }>
  //   (data: T): Promise<Buffer> {
  async generatePdfFromTemplate<T extends { settings?: { footerImageBase64?: string | null, includeFooter?: boolean, useImages?: boolean, headerImageBase64?: string | null } }>
    (data: T): Promise<Buffer> {
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'evaluation-reports', 'evaluation-report.hbs');
    const htmlTemplate = await fs.readFile(templatePath, 'utf-8');

    const template = handlebars.compile(htmlTemplate);
    const finalHtml = template(data);

    const hasImageHeader = data.settings?.useImages && data.settings?.headerImageBase64;
    const hasImageFooter = data.settings?.includeFooter && data.settings?.footerImageBase64;
    // A text footer is wanted if includeFooter is true but there's no image
    const wantsTextFooter = data.settings?.includeFooter && !hasImageFooter;

    const pdfOptions: {
      format: string;
      printBackground: boolean;
      margin: { top: string; right: string; bottom: string; left: string; };
      displayHeaderFooter?: boolean;
      headerTemplate?: string;
      footerTemplate?: string;
    } = {
      format: 'A4',
      printBackground: true,
      margin: { top: '25px', right: '25px', bottom: '25px', left: '25px' },
    };


    if (hasImageHeader || data.settings?.includeFooter) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = '<div></div>'; 

      pdfOptions.margin = {
        top: hasImageHeader ? '0' : '25px',
        right: '25px',
        bottom: hasImageFooter ? '100px' : (wantsTextFooter ? '40px' : '25px'), 
        left: '25px',
      };
      // pdfOptions.margin = {
      //   top: hasImageHeader ? '500px' : '200px',
      //   right: '25px',
      //   bottom: hasImageFooter ? '500px' : (wantsTextFooter ? '40px' : '25px'),
      //   left: '25px',
      // };

      if (hasImageHeader) {
        pdfOptions.headerTemplate = `
                <div style="width: 100%; padding: 0 25px; box-sizing: border-box;">
                    <img src="${data.settings!.headerImageBase64}" style="width: 100%; height: auto;" />
                </div>`;
      } else {
        pdfOptions.headerTemplate = '<div></div>'; // Empty header
      }

      // if (hasImageFooter && hasImageHeader) {
      //   // Use image footer if available
      //   pdfOptions.footerTemplate = `
      //               <div style="width: 100%; padding: 0 25px; box-sizing: border-box;">
      //                   <img src="${data.settings?.footerImageBase64}" style="width: 100%; height: auto;" />
      //               </div>`;
      // } else if (wantsTextFooter) {
      //   // --- THIS IS THE NEW PART ---
      //   // Use text footer with date and page number
      //   pdfOptions.footerTemplate = `
      //               <div style="width: 100%; font-size: 10px; padding: 0 25px; box-sizing: border-box; display: flex; justify-content: space-between;">
      //                   <span><span class="date"></span></span>
      //                   <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      //               </div>`;
      // } else {
      //   // No footer if includeFooter is false
      //   pdfOptions.footerTemplate = '<div></div>';
      // }


      const textFooterHtml = `
            <div style="width: 100%; font-size: 9px; padding: 5px 25px 0; box-sizing: border-box; display: flex; justify-content: space-between; border-top: 1px solid #eee;">
                <span>Evaluation Report</span>
                <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
            </div>`;

        if (hasImageFooter) {
            // CASE 1: Image and Text Footer combined
            pdfOptions.footerTemplate = `
                <div style="width: 100%;">
                    ${textFooterHtml}
                    <div style="padding: 5px 25px 0; box-sizing: border-box;">
                         <img src="${data.settings!.footerImageBase64}" style="width: 100%; height: auto;" />
                    </div>
                </div>`;
            // Increase bottom margin to fit both text and image
            pdfOptions.margin = { bottom: '140px', top: hasImageHeader ? '150px' : '25px', left: '25px', right: '25px' };

        } else if (data.settings?.includeFooter) {
            // CASE 2: Text Footer Only
            pdfOptions.footerTemplate = textFooterHtml;
            // Set a smaller margin just for the text
            pdfOptions.margin = { bottom: '40px', top: hasImageHeader ? '120px' : '25px', left: '25px', right: '25px' };

        } else {
            // CASE 3: No Footer
            pdfOptions.footerTemplate = '<div></div>';
            pdfOptions.margin = { bottom: '25px', top: hasImageHeader ? '120px' : '25px', left: '25px', right: '25px' };
        }
    

    }


    let page: Page | undefined;
    try {
      page = await this.browser.newPage();
      await page.setContent(finalHtml, { waitUntil: 'networkidle' });

      // Use the dynamically built options object
      const pdfBuffer = await page.pdf(pdfOptions);

      return pdfBuffer;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF.');
    } finally {
      if (page) await page.close();
    }
  }
}

// //#endregion



