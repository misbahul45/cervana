import { SetMetadata } from '@nestjs/common';

export const REQUIRE_IDEMPOTENCY_KEY = 'require_idempotency_key';

export const RequireIdempotencyKey = () => SetMetadata(REQUIRE_IDEMPOTENCY_KEY, true);