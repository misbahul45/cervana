import { describe, expect, it, vi } from 'vitest';
import { toApiError } from '~/lib/api-error';
import { useQueueActions } from '~/composables/useQueueActions';

const failure = (message: string, status = 409) => toApiError({ success: false, message, meta: { statusCode: status } } as never);

describe('useQueueActions', () => {
  it('runs the call with a key, reports success and refreshes the list', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const actions = useQueueActions(refresh);
    const call = vi.fn().mockResolvedValue({});

    const ok = await actions.run('approve', 'row-1', call, 'Disetujui.');

    expect(ok).toBe(true);
    expect(call).toHaveBeenCalledWith(expect.stringMatching(/.{16,}/));
    expect(actions.notice.value).toBe('Disetujui.');
    expect(actions.error.value).toBeNull();
    expect(actions.busy.value).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the same key when a failed action is retried, so the server can recognise the repeat', async () => {
    const actions = useQueueActions(async () => undefined);
    const seen: string[] = [];
    const flaky = vi
      .fn()
      .mockImplementationOnce(async (key: string) => {
        seen.push(key);
        throw failure('gagal');
      })
      .mockImplementationOnce(async (key: string) => {
        seen.push(key);
        return {};
      });

    expect(await actions.run('approve', 'row-1', flaky, 'ok')).toBe(false);
    expect(actions.error.value).toBeTruthy();
    expect(await actions.run('approve', 'row-1', flaky, 'ok')).toBe(true);

    expect(seen[0]).toBe(seen[1]);
    expect(actions.error.value).toBeNull();
  });

  it('uses a new key for the same action once it has succeeded, and a different key per row', async () => {
    const actions = useQueueActions(async () => undefined);
    const seen: string[] = [];
    const call = async (key: string) => {
      seen.push(key);
    };

    await actions.run('approve', 'row-1', call, 'ok');
    await actions.run('approve', 'row-1', call, 'ok');
    await actions.run('approve', 'row-2', call, 'ok');

    expect(new Set(seen).size).toBe(3);
  });

  it('ignores a second submit while one is running', async () => {
    const actions = useQueueActions(async () => undefined);
    let release: () => void = () => undefined;
    const slow = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));

    const first = actions.run('approve', 'row-1', slow, 'ok');
    const second = await actions.run('approve', 'row-1', slow, 'ok');
    release();
    await first;

    expect(second).toBe(false);
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it('does not refresh after a failure and clears old messages before a new attempt', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const actions = useQueueActions(refresh);

    await actions.run('reject', 'row-1', async () => Promise.reject(failure('Sudah diproses')), 'ok');
    expect(actions.error.value).toBe('Sudah diproses');
    expect(refresh).not.toHaveBeenCalled();

    await actions.run('reject', 'row-1', async () => ({}), 'Ditolak.');
    expect(actions.error.value).toBeNull();
    expect(actions.notice.value).toBe('Ditolak.');
  });

  it('clear drops both messages', async () => {
    const actions = useQueueActions(async () => undefined);
    await actions.run('approve', 'row-1', async () => ({}), 'ok');
    actions.clear();
    expect(actions.notice.value).toBeNull();
    expect(actions.error.value).toBeNull();
  });
});
