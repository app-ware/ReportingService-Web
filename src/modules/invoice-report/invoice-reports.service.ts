import { Injectable } from '@nestjs/common';
import { InvoiceReportPdfService } from './pdf.service';
import { InvoiceReportTemplateData } from './dto/template-data.interface';

@Injectable()
export class InvoiceReportsService {
  constructor(private readonly pdfService: InvoiceReportPdfService) {}

  /**
   * Takes the final, complete template data and passes it to the PdfService
   * to generate the PDF buffer.
   * @param templateData The fully assembled data object from the main API.
   * @returns A Promise resolving to the PDF file buffer.
   */
  async createPdfFromData(templateData: InvoiceReportTemplateData): Promise<Buffer> {
    return this.pdfService.generatePdfFromTemplate(templateData);
  }
}
