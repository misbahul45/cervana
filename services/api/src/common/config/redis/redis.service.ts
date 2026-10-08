import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    this.client.on('error', (err) => {
      console.error('[redis] error:', err.message);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.ping();
    } catch {
      console.warn('[redis] ping failed at boot; replay cache will be best-effort');
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
