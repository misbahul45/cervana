import { MarketplaceDiscoveryController } from '../marketplace-discovery.controller';

const build = (averageMastery: number) => {
  const discovery = { discoverFor: jest.fn().mockResolvedValue([]) };
  const prisma = {
    userTopic: { findMany: jest.fn().mockResolvedValue([{ topicId: 't1' }]) },
    subTopicProgress: { findMany: jest.fn().mockResolvedValue([{ subTopicId: 's1' }]) },
  };
  const state = { averageMastery: jest.fn().mockResolvedValue(averageMastery) };
  const controller = new MarketplaceDiscoveryController(discovery as never, prisma as never, state as never);
  return { controller, discovery, state };
};

const call = (controller: MarketplaceDiscoveryController, limit?: string) =>
  controller.recommendations({ limit }, { user: { id: 'u1' } });

describe('MarketplaceDiscoveryController', () => {
  it('uses the average concept mastery of the caller and never reads the legacy topic record', async () => {
    const { controller, discovery, state } = build(0.8);

    const response = await call(controller);

    expect(state.averageMastery).toHaveBeenCalledWith('u1');
    expect(discovery.discoverFor).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', averageMastery: 0.8, preferredDifficulty: 'ADVANCED', activeTopicIds: ['t1'], completedSubTopicIds: ['s1'] }),
      { limit: 10 },
    );
    expect(response.data).toMatchObject({ averageMastery: 0.8, preferredDifficulty: 'ADVANCED' });
  });

  it('starts a learner without evidence at the beginner level floor of 0.4', async () => {
    const { controller, discovery } = build(0);

    await call(controller);

    expect(discovery.discoverFor).toHaveBeenCalledWith(expect.objectContaining({ averageMastery: 0, preferredDifficulty: 'INTERMEDIATE' }), { limit: 10 });
  });

  it('keeps the limit between 1 and 30', async () => {
    const { controller, discovery } = build(0.5);

    await call(controller, '500');
    await call(controller, '0');

    expect(discovery.discoverFor).toHaveBeenNthCalledWith(1, expect.anything(), { limit: 30 });
    expect(discovery.discoverFor).toHaveBeenNthCalledWith(2, expect.anything(), { limit: 1 });
  });
});
