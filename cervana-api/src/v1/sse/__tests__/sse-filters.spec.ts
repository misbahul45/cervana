import { firstValueFrom, from, lastValueFrom, toArray } from 'rxjs';
import { filterByUser, filterOwnedChat } from '../sse-filters';

describe('SSE filters', () => {
  it('delivers only the caller events', async () => {
    const events = [
      { userId: 'u-1', n: 1 },
      { userId: 'u-2', n: 2 },
      { userId: 'u-1', n: 3 },
    ];
    const out = await lastValueFrom(from(events).pipe(filterByUser('u-1'), toArray()));
    expect(out.map((e) => e.n)).toEqual([1, 3]);
  });

  it('delivers chat events only for chats the caller owns and caches the decision', async () => {
    const findUnique = jest.fn().mockImplementation(async ({ where }) => ({
      userStep: { userId: where.id === 'chat-mine' ? 'u-1' : 'u-2' },
    }));
    const prisma: any = { chat: { findUnique } };
    const events = [
      { chatId: 'chat-mine', n: 1 },
      { chatId: 'chat-other', n: 2 },
      { chatId: 'chat-mine', n: 3 },
      { chatId: 'chat-other', n: 4 },
    ];
    const out = await lastValueFrom(from(events).pipe(filterOwnedChat(prisma, 'u-1'), toArray()));
    expect(out.map((e) => e.n)).toEqual([1, 3]);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('drops events for chats that no longer exist', async () => {
    const prisma: any = { chat: { findUnique: jest.fn().mockResolvedValue(null) } };
    const out = await lastValueFrom(from([{ chatId: 'gone' }]).pipe(filterOwnedChat(prisma, 'u-1'), toArray()));
    expect(out).toEqual([]);
    expect(firstValueFrom).toBeDefined();
  });
});
