import { DomainEventBus } from '../domain-event-bus';

const fakeTx = (inserted = 1) =>
  ({
    domainEvent: { createMany: jest.fn().mockResolvedValue({ count: inserted }) },
  }) as any;

const input = (overrides: Record<string, unknown> = {}) => ({
  type: 'PaymentVerified',
  aggregateType: 'PaymentIntent',
  aggregateId: 'intent-1',
  dedupeKey: 'PaymentVerified:intent-1',
  payload: { orderId: 'order-1' },
  actorId: 'admin-1',
  traceId: 'trace-1',
  ...overrides,
});

describe('DomainEventBus', () => {
  it('persists the event inside the caller transaction before running handlers', async () => {
    const bus = new DomainEventBus();
    const tx = fakeTx();
    const order: string[] = [];
    tx.domainEvent.createMany.mockImplementation(async () => {
      order.push('persist');
      return { count: 1 };
    });
    bus.subscribe('PaymentVerified', 'consumer', async () => {
      order.push('handler');
    });

    const result = await bus.publish(input(), tx);

    expect(result.published).toBe(true);
    expect(order).toEqual(['persist', 'handler']);
    expect(tx.domainEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            type: 'PaymentVerified',
            dedupeKey: 'PaymentVerified:intent-1',
            actorId: 'admin-1',
            traceId: 'trace-1',
          }),
        ],
      }),
    );
  });

  it('passes the transaction client and the event to every handler in registration order', async () => {
    const bus = new DomainEventBus();
    const tx = fakeTx();
    const calls: string[] = [];
    bus.subscribe('PaymentVerified', 'first', async (event, client) => {
      expect(client).toBe(tx);
      expect(event.payload).toEqual({ orderId: 'order-1' });
      calls.push('first');
    });
    bus.subscribe('PaymentVerified', 'second', async () => {
      calls.push('second');
    });

    await bus.publish(input(), tx);

    expect(calls).toEqual(['first', 'second']);
  });

  it('does not run handlers again for an event that was already published', async () => {
    const bus = new DomainEventBus();
    const handler = jest.fn();
    bus.subscribe('PaymentVerified', 'consumer', handler);

    const result = await bus.publish(input(), fakeTx(0));

    expect(result.published).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('propagates a handler failure so the surrounding transaction can roll back', async () => {
    const bus = new DomainEventBus();
    bus.subscribe('PaymentVerified', 'broken', async () => {
      throw new Error('handler failed');
    });

    await expect(bus.publish(input(), fakeTx())).rejects.toThrow('handler failed');
  });

  it('ignores events nobody subscribed to and registers a handler name only once', async () => {
    const bus = new DomainEventBus();
    const handler = jest.fn();
    bus.subscribe('PaymentVerified', 'consumer', handler);
    bus.subscribe('PaymentVerified', 'consumer', handler);

    await bus.publish(input({ type: 'PaymentCreated', dedupeKey: 'k' }), fakeTx());
    expect(handler).not.toHaveBeenCalled();

    await bus.publish(input(), fakeTx());
    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.handlersFor('PaymentVerified')).toEqual(['consumer']);
  });
});
