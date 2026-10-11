import { AppError, AppErrorCode } from '@/common/lib/error';
import { TopicsService } from '../topics.service';

const TOPIC_ID = '0abfe480-b7de-4758-a9c3-bb9c5ed21200';
const TOPIC_SLUG = 'topic-0abfe480';

const buildService = (found: { id: string } | null) => {
  const topicsRepo = { findOne: jest.fn().mockResolvedValue(found) };
  const service = new TopicsService(topicsRepo as never, {} as never);
  return { service, topicsRepo };
};

describe('TopicsService.findOne', () => {
  it('looks a topic up by id when the identifier is a uuid', async () => {
    const { service, topicsRepo } = buildService({ id: TOPIC_ID });

    const result = await service.findOne(TOPIC_ID, {});

    expect(topicsRepo.findOne).toHaveBeenCalledWith('id', TOPIC_ID, {});
    expect(result.data).toEqual({ id: TOPIC_ID });
  });

  it('accepts an upper-case uuid', async () => {
    const { service, topicsRepo } = buildService({ id: TOPIC_ID });

    await service.findOne(TOPIC_ID.toUpperCase(), {});

    expect(topicsRepo.findOne).toHaveBeenCalledWith('id', TOPIC_ID.toUpperCase(), {});
  });

  it('looks a topic up by slug when the identifier is not a uuid', async () => {
    const { service, topicsRepo } = buildService({ id: TOPIC_ID });

    await service.findOne(TOPIC_SLUG, {});

    expect(topicsRepo.findOne).toHaveBeenCalledWith('slug', TOPIC_SLUG, {});
  });

  it('keeps a slug that merely contains a uuid on the slug path', async () => {
    const { service, topicsRepo } = buildService({ id: TOPIC_ID });

    await service.findOne(`${TOPIC_SLUG}-${TOPIC_ID}`, {});

    expect(topicsRepo.findOne).toHaveBeenCalledWith('slug', `${TOPIC_SLUG}-${TOPIC_ID}`, {});
  });

  it('answers 404 with the NOT_FOUND code when nothing matches', async () => {
    const { service } = buildService(null);

    const failure = await service.findOne(TOPIC_ID, {}).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).statusCode).toBe(404);
    expect((failure as AppError).code).toBe(AppErrorCode.NOT_FOUND);
  });
});
