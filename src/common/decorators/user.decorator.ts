import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from 'src/modules/auth/dto/jwt-payload';

/**
 * A custom decorator to extract the user object or a specific property
 * from the request object, which is populated by the JwtAuthGuard.
 *
 * @example
 *  Get the entire user payload object
 * find(@User() user: JwtPayload)
 *
 * @example
 *  Get a specific property from the payload (user ID)
 * find(@User('sub', ParseIntPipe) userId: number)
 *
 * @example
 *  Get another property ( center ID)
 * find(@User('centerId', ParseIntPipe) centerId: number)
 */
export const User = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);