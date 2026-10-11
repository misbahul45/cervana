import { CreatorEligibilityService } from '../creator-eligibility.service';

const aggregate = (score: number | null, passedConcepts: number, totalConcepts: number) => ({
  score,
  passedConcepts,
  totalConcepts,
  evidenceCount: 9,
  lastEventAt: null,
});

const build = (result: ReturnType<typeof aggregate>) => {
  const state = { topicMastery: jest.fn().mockResolvedValue(result) };
  return { service: new CreatorEligibilityService(state as never), state };
};

describe('CreatorEligibilityService', () => {
  it('is eligible when every concept of the topic is passed and the mean reaches 0.85', async () => {
    const { service, state } = build(aggregate(0.86, 3, 3));

    expect(await service.check({ userId: 'u1', topicId: 'topic-1' })).toEqual({
      eligible: true,
      score: 0.86,
      passedConcepts: 3,
      totalConcepts: 3,
    });
    expect(state.topicMastery).toHaveBeenCalledWith('u1', 'topic-1');
  });

  it('is not eligible when the mean is below 0.85', async () => {
    expect(await build(aggregate(0.8, 3, 3)).service.check({ userId: 'u1', topicId: 'topic-1' })).toMatchObject({ eligible: false });
  });

  it('is not eligible when one concept is not passed even if the mean is high', async () => {
    expect(await build(aggregate(0.9, 2, 3)).service.check({ userId: 'u1', topicId: 'topic-1' })).toMatchObject({ eligible: false });
  });

  it('is not eligible for a topic without approved concepts and reports no score', async () => {
    expect(await build(aggregate(null, 0, 0)).service.check({ userId: 'u1', topicId: 'topic-1' })).toEqual({
      eligible: false,
      score: null,
      passedConcepts: 0,
      totalConcepts: 0,
    });
  });

  it('answers not eligible for an empty topic id without reading the learner state', async () => {
    const { service, state } = build(aggregate(0.99, 3, 3));

    expect(await service.check({ userId: 'u1', topicId: '' })).toEqual({ eligible: false, score: null, passedConcepts: 0, totalConcepts: 0 });
    expect(state.topicMastery).not.toHaveBeenCalled();
  });
});
