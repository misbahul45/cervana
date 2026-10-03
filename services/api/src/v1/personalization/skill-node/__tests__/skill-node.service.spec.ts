import { SkillNodeService } from '../skill-node.service';

describe('SkillNodeService.computeState (deterministic)', () => {
  let service: SkillNodeService;

  beforeEach(() => {
    const repo = { upsert: jest.fn().mockResolvedValue({}) };
    service = new SkillNodeService(repo as any);
  });

  it('returns LOCKED when any prerequisite mastery below threshold', () => {
    expect(service.computeState({ mastery: 0, prereqMastery: [0.5, 0.9] })).toBe('LOCKED');
  });

  it('returns AVAILABLE when prereqs met and mastery 0', () => {
    expect(service.computeState({ mastery: 0, prereqMastery: [0.9, 0.8] })).toBe('AVAILABLE');
  });

  it('returns IN_PROGRESS when mastery in (0, 0.9)', () => {
    expect(service.computeState({ mastery: 0.5, prereqMastery: [0.9] })).toBe('IN_PROGRESS');
  });

  it('returns MASTERED at mastery >= 0.9', () => {
    expect(service.computeState({ mastery: 0.95, prereqMastery: [0.9] })).toBe('MASTERED');
  });

  it('treats no prerequisites as met', () => {
    expect(service.computeState({ mastery: 0, prereqMastery: [] })).toBe('AVAILABLE');
  });
});