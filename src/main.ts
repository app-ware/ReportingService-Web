import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { REPORT_RUNTIME_CONFIG, ReportRuntimeConfig } from './config/report.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.use(new CorrelationIdMiddleware().use);
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(AppValidationPipe);
  app.setGlobalPrefix('api/v1');

  const reportConfig = app.get<ReportRuntimeConfig>(REPORT_RUNTIME_CONFIG);

  /**
   * Express defaults to a 100 KB JSON body, which a report payload carrying a base64
   * center logo and header banner exceeds easily. The parser limit is raised to the same
   * ceiling the payload validator enforces, so an oversized payload is rejected once, by
   * the validator, with a report-specific error — rather than by the parser with an
   * opaque one.
   */
  app.useBodyParser('json', { limit: reportConfig.maxPayloadBytes });

  const port = process.env.PORT || 4445;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Reporting service is running on port ${port}`);
  logger.log(
    {
      renderTimeoutMs: reportConfig.renderTimeoutMs,
      maxConcurrentRenders: reportConfig.maxConcurrentRenders,
      maxQueueDepth: reportConfig.maxQueueDepth,
      queueTimeoutMs: reportConfig.queueTimeoutMs,
      maxPayloadBytes: reportConfig.maxPayloadBytes,
      maxImageBytes: reportConfig.maxImageBytes,
    },
    'Report rendering limits in effect. Nursery\'s downstream timeout must stay above renderTimeoutMs.',
  );
}
void bootstrap();
