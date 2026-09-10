import { ExecutionContext, createParamDecorator } from '@nestjs/common';

/**
 * The correlation ID that `CorrelationIdMiddleware` attached to the request — either the
 * `X-Correlation-ID` Nursery forwarded, or one generated here when it did not.
 *
 * Report telemetry is keyed on this, which is what lets one PDF download be traced from
 * the Angular click through Nursery to this renderer.
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    (context.switchToHttp().getRequest() as { correlationId?: string }).correlationId,
);
