import { CreatorEligibilityService } from '../creator-eligibility.service';

describe('CreatorEligibilityService (deterministic)', () => {
  let service: CreatorEligibilityService;

  beforeEach(() => {
    const masteryRepo = { findByUserAndTopic: jest.fn() };
    service = new CreatorEligibilityService(masteryRepo as any);
  });

  it('returns eligible when mastery >= 0.85', async () => {
    (service as any).masteryRepo.findByUserAndTopic.mockResolvedValue({ score: 0.9 });
    const out = await service.check({ userId: 'u1', topicId: 'l1-t02-journal-keeper' });
    expect(out).toMatchObject({ eligible: true, score: 0.9 });
  });

  it('returns not-eligible when mastery below 0.85', async () => {
    (service as any).masteryRepo.findByUserAndTopic.mockResolvedValue({ score: 0.5 });
    const out = await service.check({ userId: 'u1', topicId: 'l1-t02-journal-keeper' });
    expect(out).toMatchObject({ eligible: false });
  });

  it('returns not-eligible when no mastery record', async () => {
    (service as any).masteryRepo.findByUserAndTopic.mockResolvedValue(null);
    const out = await service.check({ userId: 'u1', topicId: 'l1-t02-journal-keeper' });
    expect(out).toMatchObject({ eligible: false });
  });
});