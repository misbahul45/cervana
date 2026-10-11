import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { STUDENT_A, STUDENT_B, asUser, createHttpApp } from '@/test-utils/http-harness';
import { TopicBoardController } from '../topic-board.controller';
import { TopicBoardService } from '../topic-board.service';

describe('TopicBoardController', () => {
  let app: INestApplication;
  let boards: { board: jest.Mock; updateMembership: jest.Mock };

  beforeEach(async () => {
    boards = {
      board: jest.fn(async (userId: string, topicId: string) => ({ topicId, entries: [], me: { optedIn: false, rank: null, score: 0 }, owner: userId })),
      updateMembership: jest.fn(async (_userId: string, input: { optIn?: boolean; handle?: string }) => ({ optedIn: input.optIn ?? false, handle: input.handle ?? null })),
    };
    app = await createHttpApp({ controllers: [TopicBoardController], providers: [{ provide: TopicBoardService, useValue: boards }] });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /leaderboards/topics/:topicId', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/leaderboards/topics/t1').expect(401);
    });

    it('reads the board for the caller and passes the page size', async () => {
      await request(app.getHttpServer()).get('/leaderboards/topics/t1?limit=5&userId=' + STUDENT_B.id).set(asUser(STUDENT_A)).expect(200);

      expect(boards.board).toHaveBeenCalledWith(STUDENT_A.id, 't1', { limit: 5 });
      expect(boards.board).not.toHaveBeenCalledWith(STUDENT_B.id, expect.anything(), expect.anything());
    });
  });

  describe('PUT /leaderboards/me', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).put('/leaderboards/me').send({ optIn: true, handle: 'budi_01' }).expect(401);
    });

    it('sets the caller own membership with a normalised handle', async () => {
      const res = await request(app.getHttpServer()).put('/leaderboards/me').set(asUser(STUDENT_A)).send({ optIn: true, handle: ' Budi_01 ' }).expect(200);

      expect(boards.updateMembership).toHaveBeenCalledWith(STUDENT_A.id, { optIn: true, handle: 'budi_01' });
      expect(res.body.data).toEqual({ optedIn: true, handle: 'budi_01' });
    });

    it('refuses a bad handle, an empty body and unknown keys before touching the service', async () => {
      for (const body of [{ optIn: true, handle: 'a' }, {}, { optIn: true, userId: STUDENT_B.id }, { optIn: 'yes' }]) {
        await request(app.getHttpServer()).put('/leaderboards/me').set(asUser(STUDENT_A)).send(body).expect(400);
      }
      expect(boards.updateMembership).not.toHaveBeenCalled();
    });
  });
});
