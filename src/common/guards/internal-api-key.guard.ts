import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-internal-api-key'];
    const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key.');
    }
    return true;
  }
}