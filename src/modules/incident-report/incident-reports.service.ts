import { Injectable } from '@nestjs/common';
import { IncidentReportPdfService } from './pdf.service';
import { IncidentReportTemplateData } from './dto/template-data.interface';

@Injectable()
export class IncidentReportsService {
  constructor(private readonly pdfService: IncidentReportPdfService) {}

  /**
   * Takes the final, complete template data and passes it to the PdfService
   * to generate the PDF buffer.
   * @param templateData The fully assembled data object from the main API.
   * @returns A Promise resolving to the PDF file buffer.
   */
  async createPdfFromData(templateData: IncidentReportTemplateData): Promise<Buffer> {
    return this.pdfService.generatePdfFromTemplate(templateData);
  }
}
