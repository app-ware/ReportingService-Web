import { Controller, Post, Body, Res, Header, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InvoiceReportsService } from './invoice-reports.service';
import { InvoiceReportTemplateData } from './dto/template-data.interface';
import { InternalApiKeyGuard } from 'src/common/guards/internal-api-key.guard';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

@Controller('reports')
export class InvoiceReportsController {
  constructor(private readonly invoiceReportsService: InvoiceReportsService) {}

  @Post('invoice')
  @ResponseMessage("Pdf Generated Successfully from Reporting Service")
  @Header('Content-Type', 'application/pdf')
  @UseGuards(InternalApiKeyGuard)
  async createInvoiceReport(@Body() templateData: InvoiceReportTemplateData, @Res() res: Response) {
    const pdfBuffer = await this.invoiceReportsService.createPdfFromData(templateData);
    res.send(pdfBuffer);
  }
}
