import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { randomUUID } from 'crypto';

export const TraceId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  const incoming = req.headers?.['x-trace-id'];
  return typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
    ? incoming
    : randomUUID();
});
