import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';

/**
 * Global, and re-exporting `LoggerModule`, so that `PinoLogger` is injectable from any
 * module. `nestjs-pino`'s `LoggerModule` is not global on its own, so wrapping it without
 * re-exporting left `PinoLogger` resolvable only inside this module — every service
 * outside it that injected the logger would fail to resolve at bootstrap.
 */
@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        // In development >> 'pino-pretty' for readable logs.
        // In production  >>  undefined, logging raw, fast JSON.
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
              target: 'pino-pretty',
              options: {
                // singleLine: true,
                colorize: true,
                levelFirst: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
              },
            }
            : undefined,

        //  log level based on the environment.
        // 'debug' is useful for development, 'info' is a good default for production.
        level: process.env.NODE_ENV !== 'production' ? 'info' : 'debug',

        // custom context property to all HTTP request logs.
        customProps: (req) => ({
          context: 'HTTP',
          correlationId:(req as any).correlationId,
        }),
        serializers: {
          err: pino.stdSerializers.err,
          res: pino.stdSerializers.res,
          // req: pino.stdSerializers.req,
          req: (req) => {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
            };
          },
        }
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule { }

