import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { createHash, timingSafeEqual } from 'crypto';

const sha256 = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/**
 * The only thing standing between this service and an unauthenticated PDF render.
 *
 * Two behaviours matter here and neither was true of the previous implementation:
 *
 * 1. **Fail closed on a missing key.** The old guard compared `providedKey !== expectedKey`,
 *    so with `INTERNAL_API_KEY` unset both sides were `undefined` for a caller who sent no
 *    header — a misconfigured deployment authenticated everyone. A missing or blank
 *    configured key is now a server error, never a pass.
 * 2. **Constant-time comparison.** `!==` on strings short-circuits at the first differing
 *    byte, which leaks the key prefix to anyone who can measure response times.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(InternalApiKeyGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (!expectedKey || expectedKey.trim() === '') {
      this.logger.error(
        'INTERNAL_API_KEY is not configured. Refusing every report request rather than rendering unauthenticated.',
      );
      throw new InternalServerErrorException('Reporting service is not configured correctly.');
    }

    const providedKey = request.headers['x-internal-api-key'];

    if (typeof providedKey !== 'string' || !this.matches(providedKey, expectedKey)) {
      // No key material, and no hint about which part was wrong, reaches the response or the log.
      this.logger.warn(
        { correlationId: (request as { correlationId?: string }).correlationId },
        'Rejected a report request with a missing or invalid internal API key.',
      );
      throw new UnauthorizedException('Invalid or missing internal API key.');
    }

    return true;
  }

  /**
   * `timingSafeEqual` throws unless both buffers are the same length, and branching on
   * length is itself a timing signal. Hashing both sides to a fixed 32 bytes first keeps
   * the comparison constant-time for any input length.
   */
  private matches(provided: string, expected: string): boolean {
    return timingSafeEqual(sha256(provided), sha256(expected));
  }
}
