import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';


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
})
export class AppLoggerModule { }

