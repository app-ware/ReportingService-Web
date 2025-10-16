import { Controller, Post, Body, Res, Header, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { InternalApiKeyGuard } from 'src/common/guards/internal-api-key.guard';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

@Controller('reports')
export class ReportingController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('evaluation')
  @ResponseMessage("Pdf Generated Successfully from Reporting Service")
  @Header('Content-Type', 'application/pdf')
  @UseGuards(InternalApiKeyGuard)
  async createEvaluationReport(@Body() templateData: any, @Res() res: Response) {
    const pdfBuffer = await this.pdfService.generatePdfFromTemplate(templateData);
    res.send(pdfBuffer);
    
  }
}