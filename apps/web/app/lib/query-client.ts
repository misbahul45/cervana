import { QueryCache, QueryClient } from '@tanstack/vue-query';

export const createQueryClient = (onError?: (error: unknown) => void): QueryClient =>
  new QueryClient({
    defaultOptions: { dehydrate: { shouldDehydrateQuery: () => false } },
    queryCache: new QueryCache({ onError }),
  });
