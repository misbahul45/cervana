import { Global, Module } from '@nestjs/common';
import { DomainEventBus } from './domain-event-bus';

@Global()
@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus],
})
export class EventsModule {}
