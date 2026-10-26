import { Module } from '@nestjs/common';
import { IncidentReportsController } from './incident-reports.controller';
import { IncidentReportsService } from './incident-reports.service';

/**
 * No PDF service of its own any more: rendering, the browser, the bounded queue and the
 * payload validator all come from the global `RenderModule`, so the four report modules
 * share one Chromium instead of launching one each.
 */
@Module({
  controllers: [IncidentReportsController],
  providers: [IncidentReportsService],
})
export class IncidentReportsModule {}
