export type StageState = 'pending' | 'active' | 'done' | 'skipped' | 'failed';

export type FactTone = 'ok' | 'muted' | 'warn';

export interface AiFact {
  key: string;
  text: string;
  tone: FactTone;
}

export interface AiStage {
  key: string;
  label: string;
  state: StageState;
  detail: string;
  fact: AiFact | null;
}

export interface StageEvent {
  key: string;
  state: StageState;
  data: Record<string, unknown>;
}

const STATES: ReadonlyArray<StageState> = ['pending', 'active', 'done', 'skipped', 'failed'];

const STYLE_LABELS: Readonly<Record<string, string>> = {
  visual: 'Visual',
  auditory: 'Auditori',
  reading_writing: 'Membaca & menulis',
  kinesthetic: 'Praktik langsung',
};

export const introStages = (): AiStage[] => [
  { key: 'context', label: 'Membaca langkah pelajaran', state: 'active', detail: '', fact: null },
  { key: 'profile', label: 'Mencocokkan gaya belajarmu', state: 'pending', detail: '', fact: null },
  { key: 'retrieval', label: 'Mencari referensi pendukung', state: 'pending', detail: '', fact: null },
  { key: 'writing', label: 'Menulis pengantar', state: 'pending', detail: '', fact: null },
];

export const parseStageEvent = (raw: string): StageEvent | null => {
  try {
    const value = JSON.parse(raw) as Partial<StageEvent> | null;
    if (!value || typeof value.key !== 'string' || !STATES.includes(value.state as StageState)) return null;
    const data = value.data && typeof value.data === 'object' ? (value.data as Record<string, unknown>) : {};
    return { key: value.key, state: value.state as StageState, data };
  } catch {
    return null;
  }
};

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

const titlesOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((title): title is string => typeof title === 'string' && title.trim().length > 0) : [];

export const describeStage = (event: StageEvent): { detail: string; fact: AiFact | null } => {
  const { key, state, data } = event;

  if (key === 'context') {
    const steps = count(data.steps);
    const titles = titlesOf(data.titles);
    const names = titles.length ? `: ${titles.join(', ')}${steps > titles.length ? ', dan lainnya' : ''}` : '';
    return { detail: `${steps} langkah dibaca${names}`, fact: { key, text: `${steps} langkah kurikulum`, tone: 'ok' } };
  }

  if (key === 'profile') {
    const label = typeof data.style === 'string' ? STYLE_LABELS[data.style] : undefined;
    if (state === 'done' && label) {
      return { detail: `Gaya belajar dominanmu: ${label}`, fact: { key, text: `Gaya ${label}`, tone: 'ok' } };
    }
    return {
      detail: 'Belum ada gaya belajar yang terbaca, memakai gaya netral',
      fact: { key, text: 'Gaya netral', tone: 'muted' },
    };
  }

  if (key === 'retrieval') {
    const sources = count(data.sources);
    const queries = count(data.queries);
    if (state === 'failed') {
      return {
        detail: 'Layanan referensi sedang tidak tersedia, pengantar hanya memakai data langkah',
        fact: { key, text: 'Referensi tidak tersedia', tone: 'warn' },
      };
    }
    if (state === 'skipped') {
      return { detail: 'Pencarian referensi dilewati', fact: { key, text: 'Tanpa referensi', tone: 'muted' } };
    }
    if (sources > 0) {
      return {
        detail: `${sources} potongan referensi ditemukan dari ${queries} pencarian`,
        fact: { key, text: `${sources} referensi`, tone: 'ok' },
      };
    }
    return {
      detail: 'Tidak ada referensi tambahan yang cocok, hanya memakai data langkah',
      fact: { key, text: 'Tanpa referensi tambahan', tone: 'muted' },
    };
  }

  if (key === 'writing') {
    return { detail: 'Menulis hanya dari data yang terkumpul di atas', fact: null };
  }

  return { detail: '', fact: null };
};

const FINISHED: ReadonlyArray<StageState> = ['done', 'skipped', 'failed'];

export const applyStageEvent = (stages: AiStage[], event: StageEvent): AiStage[] => {
  const index = stages.findIndex((stage) => stage.key === event.key);
  if (index === -1) return stages;

  const described = describeStage(event);
  const next = stages.map((stage, position) => {
    if (position === index) {
      return { ...stage, state: event.state, detail: described.detail, fact: described.fact };
    }
    if (position < index && !FINISHED.includes(stage.state)) return { ...stage, state: 'done' as StageState };
    return stage;
  });

  if (FINISHED.includes(event.state) && !next.some((stage) => stage.state === 'active')) {
    const following = next.findIndex((stage, position) => position > index && stage.state === 'pending');
    if (following !== -1) next[following] = { ...next[following]!, state: 'active' };
  }
  return next;
};

export const factsOf = (stages: AiStage[]): AiFact[] => stages.flatMap((stage) => (stage.fact ? [stage.fact] : []));

export const currentStage = (stages: AiStage[]): AiStage | null =>
  stages.find((stage) => stage.state === 'active') ?? [...stages].reverse().find((stage) => FINISHED.includes(stage.state)) ?? null;

export interface StagePacer {
  push: (event: StageEvent) => void;
  flush: () => void;
  stop: () => void;
}

export const createStagePacer = (
  apply: (event: StageEvent) => void,
  gapMs: number,
  timers: { set: (run: () => void, ms: number) => unknown; clear: (handle: unknown) => void } = {
    set: (run, ms) => setTimeout(run, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
): StagePacer => {
  const queue: StageEvent[] = [];
  let handle: unknown = null;

  const drain = () => {
    handle = null;
    const event = queue.shift();
    if (!event) return;
    apply(event);
    handle = timers.set(drain, gapMs);
  };

  return {
    push(event) {
      queue.push(event);
      if (handle === null) drain();
    },
    flush() {
      if (handle !== null) timers.clear(handle);
      handle = null;
      while (queue.length) apply(queue.shift()!);
    },
    stop() {
      if (handle !== null) timers.clear(handle);
      handle = null;
      queue.length = 0;
    },
  };
};
