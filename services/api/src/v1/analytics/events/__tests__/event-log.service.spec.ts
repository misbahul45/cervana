import { EventLogService } from '../event-log.service';

describe('EventLogService.record (with PII filter)', () => {
  let service: EventLogService;

  beforeEach(() => {
    const prisma = { eventLog: { create: jest.fn().mockResolvedValue({}) } };
    service = new EventLogService(prisma as any);
  });

  it('records a LESSON_COMPLETED event', async () => {
    await service.record({ userId: 'u1', action: 'LESSON_COMPLETED', entityId: 'lesson-1' });
    expect((service as any).prisma.eventLog.create).toHaveBeenCalled();
  });

  it('strips PII (email, name) before persisting', async () => {
    await service.record({
      userId: 'u1',
      action: 'LESSON_COMPLETED',
      metadata: { email: 'a@b.c', name: 'Alice', topicId: 'l1-t01' },
    });
    const call = (service as any).prisma.eventLog.create.mock.calls[0][0];
    expect(call.data.metadata).not.toHaveProperty('email');
    expect(call.data.metadata).not.toHaveProperty('name');
    expect(call.data.metadata.topicId).toBe('l1-t01');
    expect(call.data.piiRedacted).toBe(true);
  });

  it('strips ip and authorization headers', async () => {
    await service.record({
      userId: 'u1',
      action: 'QUIZ_SUBMITTED',
      metadata: { ip: '127.0.0.1', authorization: 'Bearer x', questionId: 'q1' },
    });
    const call = (service as any).prisma.eventLog.create.mock.calls[0][0];
    expect(call.data.metadata).not.toHaveProperty('ip');
    expect(call.data.metadata).not.toHaveProperty('authorization');
    expect(call.data.metadata.questionId).toBe('q1');
  });
});