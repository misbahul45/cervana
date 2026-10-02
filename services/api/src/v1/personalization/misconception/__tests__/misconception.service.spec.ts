import { MisconceptionService } from '../misconception.service';

describe('MisconceptionService.classify (deterministic)', () => {
  let service: MisconceptionService;

  beforeEach(() => {
    const repo = { upsert: jest.fn().mockResolvedValue({}), listActiveByUser: jest.fn() };
    service = new MisconceptionService(repo as any);
  });

  it('classifies debit-credit swap when wrong answer is the inverse', () => {
    const code = service.classifyPattern({
      questionId: 'q-journal-debit-credit',
      userAnswer: 'credit Cash 100 / debit Service Revenue 100',
      correctAnswer: 'debit Cash 100 / credit Service Revenue 100',
    });
    expect(code).toBe('debit_credit_swap');
  });

  it('classifies trial-balance imbalance when wrong answer omits an entry', () => {
    const code = service.classifyPattern({
      questionId: 'q-trial-balance',
      userAnswer: '',
      correctAnswer: 'debit Cash 100 / credit Service Revenue 100',
    });
    expect(code).toBe('trial_balance_imbalance');
  });

  it('returns null for an unrecognized pattern', () => {
    const code = service.classifyPattern({
      questionId: 'q-unknown',
      userAnswer: 'x',
      correctAnswer: 'y',
    });
    expect(code).toBeNull();
  });

  it('classifies missing_credit_side when only debit is in user answer', () => {
    const code = service.classifyPattern({
      questionId: 'q-journal-x',
      userAnswer: 'debit Cash 100',
      correctAnswer: 'debit Cash 100 / credit Service Revenue 100',
    });
    expect(code).toBe('missing_credit_side');
  });
});