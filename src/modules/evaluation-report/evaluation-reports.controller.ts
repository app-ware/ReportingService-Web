import { Body, Controller, Header, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { EvaluationReportsService } from './evaluation-reports.service';
import { InternalApiKeyGuard } from 'src/common/guards/internal-api-key.guard';
import { CorrelationId } from 'src/common/decorators/correlation-id.decorator';

@Controller('reports')
export class ReportingController {
  constructor(private readonly evaluationReportsService: EvaluationReportsService) {}

  /** See `IncidentReportsController` for why `@Body()` is untyped here. */
  @Post('evaluation')
  @Header('Content-Type', 'application/pdf')
  @UseGuards(InternalApiKeyGuard)
  async createEvaluationReport(
    @Body() templateData: unknown,
    @CorrelationId() correlationId: string | undefined,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.evaluationReportsService.createPdfFromData(templateData, correlationId);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }
}
