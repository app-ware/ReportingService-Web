import { Controller, Post, Body, Res, Header, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReceiptReportsService } from './receipt-reports.service';
import { ReceiptReportTemplateData } from './dto/template-data.interface';
import { InternalApiKeyGuard } from 'src/common/guards/internal-api-key.guard';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

@Controller('reports')
export class ReceiptReportsController {
  constructor(private readonly receiptReportsService: ReceiptReportsService) {}

  @Post('receipt')
  @ResponseMessage("Pdf Generated Successfully from Reporting Service")
  @Header('Content-Type', 'application/pdf')
  @UseGuards(InternalApiKeyGuard)
  async createReceiptReport(@Body() templateData: ReceiptReportTemplateData, @Res() res: Response) {
    const pdfBuffer = await this.receiptReportsService.createPdfFromData(templateData);
    res.send(pdfBuffer);
  }
}
