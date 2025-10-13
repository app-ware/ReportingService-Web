import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule,{bufferLogs:true});

  app.useLogger(app.get(Logger))
  app.useGlobalPipes(AppValidationPipe)
  app.setGlobalPrefix('api/v1');
  const port = process.env.PORT || 4445;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Reporting service is running on port ${port}`)
}
void bootstrap();
