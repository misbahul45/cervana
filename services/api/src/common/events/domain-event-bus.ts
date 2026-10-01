import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface DomainEventInput<TPayload = object> {
  type: string;
  aggregateType: string;
  aggregateId: string;
  dedupeKey: string;
  payload: TPayload;
  tenantId?: string | null;
  actorId?: string | null;
  traceId?: string | null;
}

export interface PublishedDomainEvent<TPayload = object> extends DomainEventInput<TPayload> {
  id: string;
  occurredAt: Date;
}

export type DomainEventHandler<TPayload = any> = (
  event: PublishedDomainEvent<TPayload>,
  tx: Prisma.TransactionClient,
) => Promise<void>;

interface Registration {
  name: string;
  handle: DomainEventHandler;
}

@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly registrations = new Map<string, Registration[]>();

  subscribe<TPayload>(type: string, name: string, handle: DomainEventHandler<TPayload>): void {
    const existing = this.registrations.get(type) ?? [];
    if (existing.some((registration) => registration.name === name)) {
      return;
    }
    this.registrations.set(type, [...existing, { name, handle }]);
  }

  handlersFor(type: string): string[] {
    return (this.registrations.get(type) ?? []).map((registration) => registration.name);
  }

  async publish<TPayload extends object>(
    input: DomainEventInput<TPayload>,
    tx: Prisma.TransactionClient,
  ): Promise<{ published: boolean; event: PublishedDomainEvent<TPayload> }> {
    const event: PublishedDomainEvent<TPayload> = {
      ...input,
      id: randomUUID(),
      occurredAt: new Date(),
    };

    const inserted = await tx.domainEvent.createMany({
      data: [
        {
          id: event.id,
          type: event.type,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          dedupeKey: event.dedupeKey,
          payload: event.payload as unknown as Prisma.InputJsonValue,
          tenantId: event.tenantId ?? null,
          actorId: event.actorId ?? null,
          traceId: event.traceId ?? null,
          occurredAt: event.occurredAt,
        },
      ],
      skipDuplicates: true,
    });

    if (inserted.count === 0) {
      this.logger.debug(`Event ${event.type} already published (${event.dedupeKey})`);
      return { published: false, event };
    }

    for (const registration of this.registrations.get(event.type) ?? []) {
      await registration.handle(event, tx);
    }

    return { published: true, event };
  }
}
