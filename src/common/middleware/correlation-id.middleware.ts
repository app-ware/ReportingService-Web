import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
// import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {

    const { v4: uuidv4 } = await import('uuid');
    // check if an ID was passed from another service. If not, create a new one.
    const correlationId = req.headers['x-correlation-id'] || uuidv4();

    // attach the ID to the request object so it's accessible everywhere.
    (req as any).correlationId = correlationId;

    // set it on the response header, which is good practice.
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }
}