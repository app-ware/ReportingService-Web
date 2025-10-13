import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from './api-response.dto';
import { Logger } from 'nestjs-pino';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(@Inject(Logger) private readonly logger: Logger) { }


  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error({
      err: exception, 
      message: `Error during ${request.method} ${request.url}`,
    });

    let errorResponse: any = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const formattedErrors: ApiError[] = [];

    // Handle class-validator's detailed error array
    if (Array.isArray(errorResponse.message)) {

      errorResponse.message.forEach(err => {
        formattedErrors.push({
          status: status.toString(),
          code: 'VALIDATION_ERROR',
          title: 'Invalid Input',
          detail: err.message,
          source: { pointer: `/data/attributes/${err.field}` },
        });
      });
    } else {
      // Handle all other errors (HttpException and generic errors)
      const detail = (exception instanceof Error) ? exception.message : 'An internal server error occurred';
      formattedErrors.push({
        status: status.toString(),
        code: errorResponse.error || 'INTERNAL_SERVER_ERROR',
        title: errorResponse.message || 'An error occurred',
        detail: detail,
      });
    }

    response.status(status).json({
      jsonapi: { version: '1.0' },
      meta: {
        apiVersion: '1.0',
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
      },
      data: null,
      errors: formattedErrors,
    });
  }
}