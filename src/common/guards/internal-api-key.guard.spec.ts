import { ExecutionContext, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { InternalApiKeyGuard } from './internal-api-key.guard';

function contextWith(headers: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers, correlationId: 'cid-1' }) }),
  } as unknown as ExecutionContext;
}

function guardWith(configuredKey: string | undefined): { guard: InternalApiKeyGuard; logger: PinoLogger } {
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as PinoLogger;

  const config = { get: () => configuredKey } as unknown as ConfigService;

  return { guard: new InternalApiKeyGuard(config, logger), logger };
}

describe('InternalApiKeyGuard', () => {
  it('admits a request carrying the configured key', () => {
    const { guard } = guardWith('s3cret-key');
    expect(guard.canActivate(contextWith({ 'x-internal-api-key': 's3cret-key' }))).toBe(true);
  });

  describe('fails closed on misconfiguration', () => {
    it.each([
      ['unset', undefined],
      ['empty', ''],
      ['blank', '   '],
    ])('refuses every request when INTERNAL_API_KEY is %s, even one sending no header', (_label, configured) => {
      const { guard, logger } = guardWith(configured);

      // The regression this guards: comparing `undefined !== undefined` used to pass.
      expect(() => guard.canActivate(contextWith({}))).toThrow(InternalServerErrorException);
      expect(() => guard.canActivate(contextWith({ 'x-internal-api-key': 'anything' }))).toThrow(
        InternalServerErrorException,
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('rejects bad credentials', () => {
    it.each([
      ['a missing header', {}],
      ['an empty key', { 'x-internal-api-key': '' }],
      ['a wrong key', { 'x-internal-api-key': 'wrong-key' }],
      ['a key with a trailing space', { 'x-internal-api-key': 's3cret-key ' }],
      ['a prefix of the key', { 'x-internal-api-key': 's3cret' }],
      ['the key plus a suffix', { 'x-internal-api-key': 's3cret-key-extra' }],
      ['an array-valued header', { 'x-internal-api-key': ['s3cret-key'] }],
      ['a numeric header', { 'x-internal-api-key': 42 }],
    ])('rejects %s', (_label, headers) => {
      const { guard } = guardWith('s3cret-key');
      expect(() => guard.canActivate(contextWith(headers))).toThrow(UnauthorizedException);
    });

    it('never writes key material to the log', () => {
      const { guard, logger } = guardWith('s3cret-key');

      expect(() => guard.canActivate(contextWith({ 'x-internal-api-key': 'attacker-guess' }))).toThrow();

      const logged = JSON.stringify((logger.warn as jest.Mock).mock.calls);
      expect(logged).not.toContain('s3cret-key');
      expect(logged).not.toContain('attacker-guess');
      expect(logged).toContain('cid-1');
    });
  });
});
