import { Body, Controller, Header, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PaySlipReportsService } from './payslip-reports.service';
import { InternalApiKeyGuard } from 'src/common/guards/internal-api-key.guard';
import { CorrelationId } from 'src/common/decorators/correlation-id.decorator';

@Controller('reports')
export class PaySlipReportsController {
  constructor(private readonly paySlipReportsService: PaySlipReportsService) {}

  /** See `IncidentReportsController` for why `@Body()` is untyped here. */
  @Post('payslip')
  @Header('Content-Type', 'application/pdf')
  @UseGuards(InternalApiKeyGuard)
  async createPaySlipReport(
    @Body() templateData: unknown,
    @CorrelationId() correlationId: string | undefined,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.paySlipReportsService.createPdfFromData(templateData, correlationId);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }
}
