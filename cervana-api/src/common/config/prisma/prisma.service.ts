import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

@Injectable()
export class PrismaService
  extends PrismaClient<
    Prisma.PrismaClientOptions,
    'query' | 'info' | 'warn' | 'error'
  >
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    });

    super({
      adapter,
      log: [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    // Logging events
    this.$on('query', (e) => {
      console.log(`[Prisma Query] ${e.query}`);
      console.log(`[Params] ${e.params}`);
      console.log(`[Duration] ${e.duration}ms`);
    });

    this.$on('error', (e) => {
      console.error(`[Prisma Error] ${e.message}`);
    });

    this.$on('warn', (e) => {
      console.warn(`[Prisma Warn] ${e.message}`);
    });

    this.$on('info', (e) => {
      console.info(`[Prisma Info] ${e.message}`);
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('[Prisma] Connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('[Prisma] Disconnected from database');
  }
}
