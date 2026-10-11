import { plainText } from '~/lib/topics';

export type PathNodeState = 'done' | 'current' | 'available' | 'locked';

export interface PathSubTopic {
  id: string;
  title?: string | null;
  description?: string | null;
  sortOrder?: number;
  isUnlocked?: boolean;
  progress?: { status?: string | null } | null;
  _count?: { lessons?: number } | null;
}

export interface PathNode {
  id: string;
  title: string;
  summary: string;
  state: PathNodeState;
  lessons: number;
  to: string | null;
}

const WAVE = [0, 1, 2, 1, 0, -1, -2, -1] as const;

export const pathOffset = (index: number): number => {
  if (!Number.isInteger(index) || index < 0) return 0;
  return WAVE[index % WAVE.length] as number;
};

export const buildPathNodes = (subTopics: ReadonlyArray<PathSubTopic> | null | undefined): PathNode[] => {
  const ordered = [...(subTopics ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  let currentAssigned = false;

  return ordered.map((subTopic) => {
    const done = subTopic.progress?.status === 'COMPLETED';
    const unlocked = subTopic.isUnlocked !== false;
    let state: PathNodeState = 'available';

    if (!unlocked && !done) {
      state = 'locked';
    } else if (done) {
      state = 'done';
    } else if (!currentAssigned) {
      state = 'current';
      currentAssigned = true;
    }

    return {
      id: subTopic.id,
      title: subTopic.title?.trim() || 'Tanpa judul',
      summary: plainText(subTopic.description, 140),
      state,
      lessons: subTopic._count?.lessons ?? 0,
      to: state === 'locked' ? null : `/my-learning/sub-topics/${subTopic.id}`,
    };
  });
};

export const pathSummary = (nodes: ReadonlyArray<PathNode>): { total: number; done: number; percent: number } => {
  const total = nodes.length;
  const done = nodes.filter((node) => node.state === 'done').length;
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
};
