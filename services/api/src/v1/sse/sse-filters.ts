import { concatMap, filter, MonoTypeOperatorFunction, Observable } from 'rxjs';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { OWNER_RESOLVERS } from '@/v1/common/guards/ownership.registry';

export const filterByUser = <T extends { userId?: string }>(
  userId: string,
): MonoTypeOperatorFunction<T> => filter((event: T) => event.userId === userId);

export const filterOwnedChat = <T extends { chatId: string }>(
  prisma: PrismaService,
  userId: string,
): MonoTypeOperatorFunction<T> => {
  const decisions = new Map<string, boolean>();
  return (source: Observable<T>) =>
    source.pipe(
      concatMap(async (event: T) => {
        let allowed = decisions.get(event.chatId);
        if (allowed === undefined) {
          const owner = await OWNER_RESOLVERS.chat(prisma, event.chatId);
          allowed = owner === userId;
          decisions.set(event.chatId, allowed);
        }
        return allowed ? event : null;
      }),
      filter((event): event is T => event !== null),
    );
};
