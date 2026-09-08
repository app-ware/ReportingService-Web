import { Injectable } from '@nestjs/common';
import { ReceiptReportPdfService } from './pdf.service';
import { ReceiptReportTemplateData } from './dto/template-data.interface';

@Injectable()
export class ReceiptReportsService {
  constructor(private readonly pdfService: ReceiptReportPdfService) {}

  /**
   * Takes the final, complete template data and passes it to the PdfService
   * to generate the PDF buffer.
   * @param templateData The fully assembled data object from the main API.
   * @returns A Promise resolving to the PDF file buffer.
   */
  async createPdfFromData(templateData: ReceiptReportTemplateData): Promise<Buffer> {
    return this.pdfService.generatePdfFromTemplate(templateData);
  }
}
