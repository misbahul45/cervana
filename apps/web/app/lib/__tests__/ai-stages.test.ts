import { describe, expect, it, vi } from 'vitest';
import {
  applyStageEvent,
  createStagePacer,
  currentStage,
  describeStage,
  factsOf,
  introStages,
  parseStageEvent,
  type StageEvent,
} from '~/lib/ai-stages';

const event = (key: string, state: StageEvent['state'], data: Record<string, unknown> = {}): StageEvent => ({ key, state, data });

describe('parseStageEvent', () => {
  it('reads a well formed event', () => {
    expect(parseStageEvent('{"key":"context","state":"done","data":{"steps":2}}')).toEqual(event('context', 'done', { steps: 2 }));
  });

  it('rejects garbage, unknown states and missing keys', () => {
    expect(parseStageEvent('not json')).toBeNull();
    expect(parseStageEvent('null')).toBeNull();
    expect(parseStageEvent('{"key":"context","state":"exploding"}')).toBeNull();
    expect(parseStageEvent('{"state":"done"}')).toBeNull();
  });

  it('treats a missing data object as empty', () => {
    expect(parseStageEvent('{"key":"writing","state":"active"}')).toEqual(event('writing', 'active'));
  });
});

describe('describeStage', () => {
  it('reports the real step count and names the first titles', () => {
    const described = describeStage(event('context', 'done', { steps: 5, titles: ['Debit', 'Kredit', 'Jurnal'] }));

    expect(described.detail).toBe('5 langkah dibaca: Debit, Kredit, Jurnal, dan lainnya');
    expect(described.fact).toEqual({ key: 'context', text: '5 langkah kurikulum', tone: 'ok' });
  });

  it('does not say "dan lainnya" when every title is listed', () => {
    expect(describeStage(event('context', 'done', { steps: 2, titles: ['A', 'B'] })).detail).toBe('2 langkah dibaca: A, B');
  });

  it('names the learning style it matched, or admits the neutral fallback', () => {
    expect(describeStage(event('profile', 'done', { style: 'reading_writing' })).fact?.text).toBe('Gaya Membaca & menulis');
    const neutral = describeStage(event('profile', 'skipped', { style: null }));
    expect(neutral.fact).toEqual({ key: 'profile', text: 'Gaya netral', tone: 'muted' });
    expect(neutral.detail).toContain('gaya netral');
  });

  it('counts the references that were really found', () => {
    const described = describeStage(event('retrieval', 'done', { sources: 4, queries: 2, failed: 0 }));

    expect(described.detail).toBe('4 potongan referensi ditemukan dari 2 pencarian');
    expect(described.fact?.tone).toBe('ok');
  });

  it('is honest when no reference was found, was skipped, or the service failed', () => {
    expect(describeStage(event('retrieval', 'done', { sources: 0, queries: 2 })).fact?.tone).toBe('muted');
    expect(describeStage(event('retrieval', 'skipped')).fact?.text).toBe('Tanpa referensi');
    const failed = describeStage(event('retrieval', 'failed', { sources: 0, queries: 2, failed: 2 }));
    expect(failed.fact).toEqual({ key: 'retrieval', text: 'Referensi tidak tersedia', tone: 'warn' });
    expect(failed.detail).toContain('tidak tersedia');
  });

  it('never invents a number from bad input', () => {
    expect(describeStage(event('retrieval', 'done', { sources: 'banyak', queries: -3 })).fact?.tone).toBe('muted');
    expect(describeStage(event('context', 'done', { steps: Number.NaN })).detail).toBe('0 langkah dibaca');
  });
});

describe('applyStageEvent', () => {
  it('starts with the first stage active and the rest waiting', () => {
    expect(introStages().map((stage) => stage.state)).toEqual(['active', 'pending', 'pending', 'pending']);
  });

  it('moves the spotlight to the next stage when one finishes', () => {
    const next = applyStageEvent(introStages(), event('context', 'done', { steps: 1, titles: ['Apa itu akuntansi'] }));

    expect(next.map((stage) => stage.state)).toEqual(['done', 'active', 'pending', 'pending']);
    expect(next[0]!.detail).toBe('1 langkah dibaca: Apa itu akuntansi');
  });

  it('walks through the whole pipeline and ends on the writing stage', () => {
    let stages = introStages();
    stages = applyStageEvent(stages, event('context', 'done', { steps: 1, titles: ['A'] }));
    stages = applyStageEvent(stages, event('profile', 'done', { style: 'visual' }));
    stages = applyStageEvent(stages, event('retrieval', 'failed', { sources: 0, queries: 1, failed: 1 }));
    stages = applyStageEvent(stages, event('writing', 'active'));

    expect(stages.map((stage) => stage.state)).toEqual(['done', 'done', 'failed', 'active']);
    expect(currentStage(stages)?.key).toBe('writing');
    expect(factsOf(stages).map((fact) => fact.text)).toEqual(['1 langkah kurikulum', 'Gaya Visual', 'Referensi tidak tersedia']);
  });

  it('closes earlier stages that the server never reported', () => {
    const next = applyStageEvent(introStages(), event('retrieval', 'done', { sources: 1, queries: 1 }));

    expect(next.map((stage) => stage.state)).toEqual(['done', 'done', 'done', 'active']);
  });

  it('ignores a stage it does not know', () => {
    const stages = introStages();

    expect(applyStageEvent(stages, event('telepathy', 'done'))).toBe(stages);
  });

  it('does not mutate the previous list', () => {
    const stages = introStages();

    applyStageEvent(stages, event('context', 'done', { steps: 1 }));

    expect(stages[0]!.state).toBe('active');
  });
});

describe('createStagePacer', () => {
  const fakeTimers = () => {
    const jobs: Array<{ id: number; run: () => void }> = [];
    let next = 1;
    return {
      jobs,
      timers: {
        set: (run: () => void) => {
          const id = next++;
          jobs.push({ id, run });
          return id;
        },
        clear: (handle: unknown) => {
          const at = jobs.findIndex((job) => job.id === handle);
          if (at !== -1) jobs.splice(at, 1);
        },
      },
      tick: () => jobs.shift()?.run(),
    };
  };

  it('shows the first event at once and spaces out the rest', () => {
    const applied: string[] = [];
    const clock = fakeTimers();
    const pacer = createStagePacer((e) => applied.push(e.key), 500, clock.timers);

    pacer.push(event('context', 'done'));
    pacer.push(event('profile', 'done'));
    pacer.push(event('retrieval', 'done'));

    expect(applied).toEqual(['context']);
    clock.tick();
    expect(applied).toEqual(['context', 'profile']);
    clock.tick();
    expect(applied).toEqual(['context', 'profile', 'retrieval']);
  });

  it('flush shows everything that is still waiting, in order', () => {
    const applied: string[] = [];
    const clock = fakeTimers();
    const pacer = createStagePacer((e) => applied.push(e.key), 500, clock.timers);

    pacer.push(event('context', 'done'));
    pacer.push(event('profile', 'done'));
    pacer.push(event('writing', 'active'));
    pacer.flush();

    expect(applied).toEqual(['context', 'profile', 'writing']);
    expect(clock.jobs).toHaveLength(0);
  });

  it('stop drops what is waiting', () => {
    const apply = vi.fn();
    const clock = fakeTimers();
    const pacer = createStagePacer(apply, 500, clock.timers);

    pacer.push(event('context', 'done'));
    pacer.push(event('profile', 'done'));
    pacer.stop();
    clock.tick();

    expect(apply).toHaveBeenCalledTimes(1);
  });
});
