import { Body, Controller, Header, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InvoiceReportsService } from './invoice-reports.service';
import { InternalApiKeyGuard } from 'src/common/guards/internal-api-key.guard';
import { CorrelationId } from 'src/common/decorators/correlation-id.decorator';

@Controller('reports')
export class InvoiceReportsController {
  constructor(private readonly invoiceReportsService: InvoiceReportsService) {}

  /** See `IncidentReportsController` for why `@Body()` is untyped here. */
  @Post('invoice')
  @Header('Content-Type', 'application/pdf')
  @UseGuards(InternalApiKeyGuard)
  async createInvoiceReport(
    @Body() templateData: unknown,
    @CorrelationId() correlationId: string | undefined,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.invoiceReportsService.createPdfFromData(templateData, correlationId);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }
}
