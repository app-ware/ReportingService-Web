import { Module } from '@nestjs/common';
import { EvaluationReportsService } from './evaluation-reports.service';
import { EvaluationReportsController } from './evaluation-reports.controller';
import { MssqlClientModule } from 'src/config/mssql/mssql-client.module';
import { PdfService } from './pdf.service';

@Module({
  imports: [MssqlClientModule],
  controllers: [EvaluationReportsController],
  providers: [EvaluationReportsService,PdfService],
})
export class EvaluationReportsModule {}
