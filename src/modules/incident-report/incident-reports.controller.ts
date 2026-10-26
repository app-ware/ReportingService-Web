import { Body, Controller, Header, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { IncidentReportsService } from './incident-reports.service';
import { InternalApiKeyGuard } from 'src/common/guards/internal-api-key.guard';
import { CorrelationId } from 'src/common/decorators/correlation-id.decorator';

@Controller('reports')
export class IncidentReportsController {
  constructor(private readonly incidentReportsService: IncidentReportsService) {}

  /**
   * `@Body()` is intentionally untyped: the global `AppValidationPipe` cannot validate an
   * interface-shaped body (it skips plain `Object` metatypes), so the report contract is
   * enforced by `ReportPayloadValidator` inside the service instead — version-aware, and
   * without changing the global validation policy for unrelated endpoints.
   */
  @Post('incident')
  @Header('Content-Type', 'application/pdf')
  @UseGuards(InternalApiKeyGuard)
  async createIncidentReport(
    @Body() templateData: unknown,
    @CorrelationId() correlationId: string | undefined,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.incidentReportsService.createPdfFromData(templateData, correlationId);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }
}
