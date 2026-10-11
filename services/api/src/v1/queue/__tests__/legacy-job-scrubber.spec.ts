import { LegacyJobScrubber } from '../legacy-job-scrubber';

const makeJob = (data: unknown) => ({ data, updateData: jest.fn().mockResolvedValue(undefined) });

const makeQueue = (jobs: ReturnType<typeof makeJob>[]) => ({ getJobs: jest.fn().mockResolvedValue(jobs) });

describe('LegacyJobScrubber', () => {
  it('removes credential-like fields from retained jobs and keeps everything else', async () => {
    const stale = makeJob({ userId: 'u-1', lessonId: 'l-1', token: 'eyJ.legacy.jwt', Authorization: 'Bearer x' });
    const clean = makeJob({ userId: 'u-1', lessonId: 'l-1' });
    const scrubber = new LegacyJobScrubber(makeQueue([stale, clean]) as any, makeQueue([]) as any, makeQueue([]) as any);

    const scrubbed = await scrubber.scrubAll();

    expect(scrubbed).toBe(1);
    expect(stale.updateData).toHaveBeenCalledWith({ userId: 'u-1', lessonId: 'l-1' });
    expect(clean.updateData).not.toHaveBeenCalled();
  });

  it('looks at every state in which a job can be retained, in every queue', async () => {
    const queues = [makeQueue([]), makeQueue([]), makeQueue([])];
    const scrubber = new LegacyJobScrubber(queues[0] as any, queues[1] as any, queues[2] as any);

    await scrubber.scrubAll();

    for (const queue of queues) {
      expect(queue.getJobs).toHaveBeenCalledTimes(1);
      expect(queue.getJobs.mock.calls[0][0]).toEqual(
        expect.arrayContaining(['waiting', 'delayed', 'failed', 'paused', 'prioritized', 'active', 'completed']),
      );
    }
  });

  it('counts the jobs of all queues and tolerates jobs without data', async () => {
    const jobs = [makeJob({ token: 'a' }), makeJob(null), makeJob(undefined), makeJob({ accessToken: 'b', cookie: 'c' })];
    const scrubber = new LegacyJobScrubber(makeQueue([jobs[0], jobs[1]]) as any, makeQueue([jobs[2]]) as any, makeQueue([jobs[3]]) as any);

    await expect(scrubber.scrubAll()).resolves.toBe(2);
    expect(jobs[3].updateData).toHaveBeenCalledWith({});
  });

  it('is idempotent: a scrubbed job is not changed again', async () => {
    const job = makeJob({ userId: 'u-1', token: 'jwt' });
    job.updateData.mockImplementation(async (data: unknown) => {
      job.data = data as any;
    });
    const scrubber = new LegacyJobScrubber(makeQueue([job]) as any, makeQueue([]) as any, makeQueue([]) as any);

    await scrubber.scrubAll();
    await scrubber.scrubAll();

    expect(job.updateData).toHaveBeenCalledTimes(1);
  });

  it('keeps scrubbing the other queues when one queue fails', async () => {
    const failing = { getJobs: jest.fn().mockRejectedValue(new Error('redis down')) };
    const job = makeJob({ token: 'jwt' });
    const scrubber = new LegacyJobScrubber(failing as any, makeQueue([job]) as any, makeQueue([]) as any);

    await expect(scrubber.scrubAll()).resolves.toBe(1);
  });

  it('never prevents the application from starting', async () => {
    const failing = { getJobs: jest.fn().mockRejectedValue(new Error('redis down')) };
    const scrubber = new LegacyJobScrubber(failing as any, failing as any, failing as any);

    await expect(scrubber.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
