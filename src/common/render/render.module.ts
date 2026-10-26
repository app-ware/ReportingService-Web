import { Global, Module } from '@nestjs/common';
import { BrowserManagerService } from './browser-manager.service';
import { RenderQueueService } from './render-queue.service';
import { PdfRendererService } from './pdf-renderer.service';
import { ReportTemplateService } from './report-template.service';
import { ReportFontService } from './report-font.service';
import { ReportFooterBuilder } from './report-footer.builder';
import { ReportLocalizationService } from './report-localization.service';
import { ReportRenderPipeline } from './report-render.pipeline';
import { ReportPayloadValidator } from 'src/common/report-contract/report-payload.validator';
import { REPORT_RUNTIME_CONFIG, buildReportRuntimeConfig } from 'src/config/report.config';

/**
 * The rendering substrate every report module shares.
 *
 * Global because all four report modules need every one of these and none of them owns
 * any of it — in particular the browser must be a single instance process-wide, which is
 * the whole point of replacing the four independent `chromium.launch()` calls.
 */
@Global()
@Module({
  providers: [
    { provide: REPORT_RUNTIME_CONFIG, useFactory: () => buildReportRuntimeConfig() },
    {
      provide: ReportPayloadValidator,
      useFactory: (config) => new ReportPayloadValidator(config),
      inject: [REPORT_RUNTIME_CONFIG],
    },
    BrowserManagerService,
    RenderQueueService,
    PdfRendererService,
    ReportTemplateService,
    ReportFontService,
    ReportFooterBuilder,
    ReportLocalizationService,
    ReportRenderPipeline,
  ],
  exports: [
    REPORT_RUNTIME_CONFIG,
    ReportPayloadValidator,
    BrowserManagerService,
    RenderQueueService,
    PdfRendererService,
    ReportTemplateService,
    ReportFontService,
    ReportFooterBuilder,
    ReportLocalizationService,
    ReportRenderPipeline,
  ],
})
export class RenderModule {}
