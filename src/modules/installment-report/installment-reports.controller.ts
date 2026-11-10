import { Body, Controller, Header, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InstallmentReportsService } from './installment-reports.service';
import { InternalApiKeyGuard } from 'src/common/guards/internal-api-key.guard';
import { CorrelationId } from 'src/common/decorators/correlation-id.decorator';

@Controller('reports')
export class InstallmentReportsController {
  constructor(private readonly installmentReportsService: InstallmentReportsService) {}

  /** See `IncidentReportsController` for why `@Body()` is untyped here. */
  @Post('installment')
  @Header('Content-Type', 'application/pdf')
  @UseGuards(InternalApiKeyGuard)
  async createInstallmentReport(
    @Body() templateData: unknown,
    @CorrelationId() correlationId: string | undefined,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.installmentReportsService.createPdfFromData(templateData, correlationId);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }
}
