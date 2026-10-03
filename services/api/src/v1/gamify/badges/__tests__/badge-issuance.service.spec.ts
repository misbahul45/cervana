import { BadgeIssuanceService } from '../badge-issuance.service';

describe('BadgeIssuanceService.evaluate (deterministic)', () => {
  let service: BadgeIssuanceService;

  beforeEach(() => {
    const repo = {
      awardIfMissing: jest.fn().mockResolvedValue(true),
      listMasters: jest.fn().mockResolvedValue([]),
    };
    service = new BadgeIssuanceService(repo as any);
  });

  it('awards FIRST_STEP after any mastery > 0', async () => {
    const result = await service.evaluate({ userId: 'u1', mastery: { 'l1-t01': 0.5 }, streak: 0 });
    expect(result.awarded).toContain('badge-first-step');
  });

  it('awards topic-mastery badge when topic mastery >= 0.9', async () => {
    const result = await service.evaluate({
      userId: 'u1',
      mastery: { 'l1-t02-journal-keeper': 0.95 },
      streak: 0,
    });
    expect(result.awarded.some((b: string) => b.startsWith('badge-journal'))).toBe(true);
  });

  it('does not award topic-mastery badge below threshold', async () => {
    const result = await service.evaluate({
      userId: 'u1',
      mastery: { 'l1-t02-journal-keeper': 0.5 },
      streak: 0,
    });
    expect(result.awarded.filter((b: string) => b.startsWith('badge-journal'))).toHaveLength(0);
  });

  it('awards STREAK badge at streak >= 7', async () => {
    const result = await service.evaluate({ userId: 'u1', mastery: {}, streak: 7 });
    expect(result.awarded).toContain('badge-streak-7');
  });

  it('does not award anything when mastery empty and streak = 0', async () => {
    const result = await service.evaluate({ userId: 'u1', mastery: {}, streak: 0 });
    expect(result.awarded).toHaveLength(0);
  });
});