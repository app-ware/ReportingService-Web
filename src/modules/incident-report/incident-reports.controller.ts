import { Controller, Post, Body, Res, Header, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { IncidentReportsService } from './incident-reports.service';
import { IncidentReportTemplateData } from './dto/template-data.interface';
import { InternalApiKeyGuard } from 'src/common/guards/internal-api-key.guard';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

@Controller('reports')
export class IncidentReportsController {
  constructor(private readonly incidentReportsService: IncidentReportsService) {}

  @Post('incident')
  @ResponseMessage("Pdf Generated Successfully from Reporting Service")
  @Header('Content-Type', 'application/pdf')
  @UseGuards(InternalApiKeyGuard)
  async createIncidentReport(@Body() templateData: IncidentReportTemplateData, @Res() res: Response) {
    const pdfBuffer = await this.incidentReportsService.createPdfFromData(templateData);
    res.send(pdfBuffer);
  }
}
