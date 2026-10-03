import { LevelService } from '../level-calculation.service';

describe('LevelService.computeLevel (deterministic)', () => {
  let service: LevelService;

  beforeEach(() => {
    const activityRepo = { sumXpForUser: jest.fn().mockResolvedValue(0) };
    service = new LevelService(activityRepo as any);
  });

  it('returns level 1 when xp = 0', () => {
    expect(service.computeLevel(0)).toBe(1);
  });

  it('returns level 2 at xp >= 100', () => {
    expect(service.computeLevel(100)).toBe(2);
    expect(service.computeLevel(149)).toBe(2);
  });

  it('returns level 3 at xp >= 150', () => {
    expect(service.computeLevel(150)).toBe(3);
  });

  it('returns level 10 at xp >= 2500', () => {
    expect(service.computeLevel(2500)).toBe(10);
  });

  it('returns level 12 at xp >= 4500', () => {
    expect(service.computeLevel(4500)).toBe(12);
  });

  it('returns highest known level for very large xp', () => {
    expect(service.computeLevel(99_999)).toBe(12);
  });
});