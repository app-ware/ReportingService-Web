import { Module } from '@nestjs/common';
import { ReportingController } from './evaluation-reports.controller';
import { EvaluationReportsService } from './evaluation-reports.service';

/** Rendering infrastructure comes from the global `RenderModule` — see IncidentReportsModule. */
@Module({
  controllers: [ReportingController],
  providers: [EvaluationReportsService],
})
export class EvaluationReportsModule {}
