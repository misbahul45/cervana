import { THEME_ICON_NAMES } from '../themes/theme-icons';
import { AchievementRule } from '../achievements/achievement-rule';

export type SeedAchievementType = 'STREAK' | 'QUIZ' | 'TOPIC' | 'LESSON' | 'SCORE' | 'PARTICIPATION';

export interface SeedAchievement {
  code: string;
  title: string;
  description: string;
  type: SeedAchievementType;
  iconName: (typeof THEME_ICON_NAMES)[number];
  rule: AchievementRule;
  sortOrder: number;
}

const rule = (metric: AchievementRule['metric'], value: number): AchievementRule => ({ metric, op: '>=', value });

export const DEFAULT_ACHIEVEMENTS: ReadonlyArray<SeedAchievement> = [
  { code: 'first-assessment', title: 'Langkah Pertama', description: 'Selesaikan penilaian pertamamu dan buktikan apa yang sudah kamu pahami.', type: 'QUIZ', iconName: 'badge', rule: rule('ASSESSMENTS_COMPLETED', 1), sortOrder: 10 },
  { code: 'five-assessments', title: 'Konsisten Berlatih', description: 'Selesaikan 5 penilaian. Setiap penilaian menambah bukti penguasaanmu.', type: 'QUIZ', iconName: 'badge', rule: rule('ASSESSMENTS_COMPLETED', 5), sortOrder: 20 },
  { code: 'twenty-assessments', title: 'Pembelajar Tekun', description: 'Selesaikan 20 penilaian dengan bukti belajar yang tercatat.', type: 'QUIZ', iconName: 'trophy', rule: rule('ASSESSMENTS_COMPLETED', 20), sortOrder: 30 },
  { code: 'first-concept', title: 'Konsep Pertama', description: 'Lulus satu konsep: skor 0,7 atau lebih dengan sedikitnya tiga bukti.', type: 'SCORE', iconName: 'node', rule: rule('CONCEPTS_PASSED', 1), sortOrder: 40 },
  { code: 'five-concepts', title: 'Lima Konsep', description: 'Lulus lima konsep. Penguasaan dihitung dari bukti, bukan dari jumlah klik.', type: 'SCORE', iconName: 'node', rule: rule('CONCEPTS_PASSED', 5), sortOrder: 50 },
  { code: 'first-node', title: 'Simpul Pertama Dikuasai', description: 'Kuasai semua konsep dalam satu sub-topik dan dapatkan bintang pertamamu.', type: 'TOPIC', iconName: 'star', rule: rule('NODES_MASTERED', 1), sortOrder: 60 },
  { code: 'streak-3', title: 'Tiga Hari Beruntun', description: 'Belajar dengan penilaian tiga hari berturut-turut.', type: 'STREAK', iconName: 'streak', rule: rule('STREAK_DAYS', 3), sortOrder: 70 },
  { code: 'streak-7', title: 'Seminggu Penuh', description: 'Pertahankan streak tujuh hari dan dapatkan pembeku streak pertamamu.', type: 'STREAK', iconName: 'streak', rule: rule('STREAK_DAYS', 7), sortOrder: 80 },
  { code: 'streak-30', title: 'Sebulan Tanpa Putus', description: 'Pertahankan streak tiga puluh hari.', type: 'STREAK', iconName: 'streak', rule: rule('STREAK_DAYS', 30), sortOrder: 90 },
  { code: 'level-5', title: 'Naik ke Level 5', description: 'Capai level 5 dari XP yang kamu peroleh lewat penguasaan konsep.', type: 'PARTICIPATION', iconName: 'level', rule: rule('LEVEL', 5), sortOrder: 100 },
  { code: 'level-10', title: 'Naik ke Level 10', description: 'Capai level 10. Hanya penguasaan terbukti yang menambah XP.', type: 'PARTICIPATION', iconName: 'trophy', rule: rule('LEVEL', 10), sortOrder: 110 },
];
