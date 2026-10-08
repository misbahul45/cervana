import { SandboxController } from '../sandbox.controller';

const scenario = {
  id: 's-1',
  topicId: 'l1-t03-journal-entries',
  level: 1,
  title: 'Beli persediaan tunai',
  description: 'desc',
  difficulty: 'BEGINNER',
  expectedLines: [
    { accountId: 'Inventory', side: 'DEBIT', amount: 100 },
    { accountId: 'Cash', side: 'CREDIT', amount: 100 },
  ],
};

describe('GET /sandbox/scenarios', () => {
  const build = () => {
    const provider = { list: jest.fn().mockReturnValue([scenario]), findById: jest.fn() };
    return new SandboxController({} as any, provider as any);
  };

  it('never sends the answer key to the learner', () => {
    const result = build().list({}) as unknown as Array<Record<string, unknown>>;

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('expectedLines');
    expect(JSON.stringify(result)).not.toContain('Inventory');
  });

  it('keeps everything the scenario picker needs', () => {
    const [shown] = build().list({}) as unknown as Array<Record<string, unknown>>;

    expect(shown).toMatchObject({
      id: 's-1',
      topicId: 'l1-t03-journal-entries',
      level: 1,
      title: 'Beli persediaan tunai',
      description: 'desc',
      difficulty: 'BEGINNER',
    });
  });
});
