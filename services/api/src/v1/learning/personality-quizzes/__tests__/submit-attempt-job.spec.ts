import { PersonalityQuizzesService } from '../personality-quizzes.service';

describe('PersonalityQuizzesService.submitAttempt job', () => {
  const quiz = { id: 'q-1', userId: 'u-1' };
  const values = [{ question: 'Saya suka kerja tim', userAnswer: 'Setuju', answer: 'Setuju' }];
  const data = { userId: 'u-1', topicId: 't-1', lessonId: 'l-1', learningStyleId: 'ls-1', quizId: 'q-1' };

  let repo: { findOne: jest.Mock; update: jest.Mock };
  let queue: { addUserStepsJob: jest.Mock };
  let service: PersonalityQuizzesService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue(quiz),
      update: jest.fn().mockResolvedValue({ id: 'q-1' }),
    };
    queue = { addUserStepsJob: jest.fn().mockResolvedValue(undefined) };
    service = new PersonalityQuizzesService(repo as any, queue as any);
  });

  it('queues the job with the five identifiers and nothing else', async () => {
    await service.submitAttempt({ ...data, token: 'jwt-value', extra: 'x' } as any, values as any);

    expect(queue.addUserStepsJob).toHaveBeenCalledTimes(1);
    expect(queue.addUserStepsJob).toHaveBeenCalledWith(data);
    expect(JSON.stringify(queue.addUserStepsJob.mock.calls)).not.toContain('jwt-value');
  });

  it('rejects an incomplete request before saving the attempt', async () => {
    await expect(service.submitAttempt({ ...data, lessonId: undefined } as any, values as any)).rejects.toThrow();

    expect(repo.update).not.toHaveBeenCalled();
    expect(queue.addUserStepsJob).not.toHaveBeenCalled();
  });

  it('does not queue anything when the quiz does not exist', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.submitAttempt(data, values as any)).rejects.toMatchObject({ statusCode: 404 });

    expect(queue.addUserStepsJob).not.toHaveBeenCalled();
  });
});
