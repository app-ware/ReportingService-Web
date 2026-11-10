import { Module } from '@nestjs/common';
import { InstallmentReportsController } from './installment-reports.controller';
import { InstallmentReportsService } from './installment-reports.service';

/** Rendering infrastructure comes from the global `RenderModule`, see IncidentReportsModule. */
@Module({
  controllers: [InstallmentReportsController],
  providers: [InstallmentReportsService],
})
export class InstallmentReportsModule {}
