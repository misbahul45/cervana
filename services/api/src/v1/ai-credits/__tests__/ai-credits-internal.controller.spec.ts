import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AiCreditsInternalController } from '../ai-credits-internal.controller';
import { AiCreditsService } from '../ai-credits.service';
import { REQUIRE_IDEMPOTENCY_KEY } from '@/common/idempotency/require-idempotency-key.decorator';
import { ACCESS_KEY } from '@/common/authz/access';

describe('AiCreditsInternalController (I-01 + BF-13)', () => {
  let controller: AiCreditsInternalController;
  let service: Pick<AiCreditsService, 'reserve' | 'settle' | 'release' | 'topUp'>;

  beforeEach(() => {
    service = {
      reserve: jest.fn(),
      settle: jest.fn(),
      release: jest.fn(),
      topUp: jest.fn(),
    };
    controller = new AiCreditsInternalController(service as any);
  });

  it('controller class has InternalOnly metadata (access=internal)', () => {
    const meta = Reflect.getMetadata(ACCESS_KEY, AiCreditsInternalController);
    expect(meta).toBe('internal');
  });

  it.each([
    ['reserve'],
    ['settle'],
    ['release'],
    ['topUp'],
  ])('decorator %s has RequireIdempotencyKey metadata', (handlerName) => {
    const handler = (controller as any)[handlerName];
    const meta = Reflect.getMetadata(REQUIRE_IDEMPOTENCY_KEY, handler);
    expect(meta).toBe(true);
  });
});