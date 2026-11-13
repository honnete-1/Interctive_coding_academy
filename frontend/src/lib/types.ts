// Shapes returned by the Django API. Keep in sync with backend/apps/*/views.py.

export type Theme = "light" | "dark" | "system";

export interface Profile {
  display_name: string;
  avatar: { base?: string; color?: string; accessory?: string };
  onboarding_completed: boolean;
  experience: "none" | "a_little" | "some" | "experienced";
  motivation: string;
  specializations: string[];
  interests: string[];
  english_comfort: number;
  guidance: "guided" | "balanced" | "exploratory";
  weekly_minutes: number;
  diagnostic_score: number | null;
  theme: Theme;
  reduced_motion: boolean;
  font_scale: number;
  interface_mode: "adventure" | "focus";
  language: string;
}

export interface User {
  id: number;
  email: string;
  role: string;
  profile: Profile;
}

export type LessonStatus = "completed" | "in_progress" | "available" | "locked";

export interface LessonSummary {
  slug: string;
  title: string;
  summary: string;
  kind: "lesson" | "mission" | "boss" | "capstone";
  xp: number;
  estimated_minutes: number;
  status: LessonStatus;
  lock_reason: string | null;
}

export interface World {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  order: number;
  theme: string;
  is_available: boolean;
  prerequisite_note: string;
  lesson_count: number;
  completed_count: number;
  modules: { slug: string; title: string; description: string; lessons: LessonSummary[] }[];
}

export interface VisibleTest {
  id: number;
  name: string;
  kind: "stdout" | "variables";
  stdin?: string;
  expected_stdout?: string;
  match?: string;
  expected_variables?: Record<string, unknown>;
}

export type RobotCmd = "forward" | "left" | "right" | "pick" | "drop" | "repeat";
export interface RobotBlock {
  cmd: RobotCmd;
  times?: number;
  body?: RobotBlock[];
}
export interface RobotSpec {
  grid: string[];
  facing?: "N" | "E" | "S" | "W";
  allowed?: RobotCmd[];
  max_blocks?: number;
  starter_program?: RobotBlock[];
}

export interface Challenge {
  id: number;
  slug: string;
  title: string;
  kind: "code" | "robot";
  tier: "micro" | "project" | "transfer" | "debug" | "capstone";
  prompt: string;
  requirements: string[];
  starter_code: string;
  spec: RobotSpec;
  xp: number;
  required: boolean;
  hint_count: number;
  visible_tests: VisibleTest[];
  hidden_test_count: number;
  skills: string[];
}

export interface Hint {
  level: number;
  text: string;
}

export type Block =
  | { type: "story"; id: string; title?: string; body: string; scene?: string }
  | { type: "explain"; id: string; title?: string; body: string; code?: string; note?: string; analogy?: string; actual?: string }
  | { type: "visual"; id: string; component: string; caption?: string; config: Record<string, unknown> }
  | { type: "predict"; id: string; question: string; code?: string; options: { id: string; label: string }[]; required?: boolean }
  | { type: "sequence"; id: string; prompt: string; items: { id: string; label: string }[]; required?: boolean }
  | { type: "xray"; id: string; title?: string; prompt?: string; code: string; stdin?: string }
  | { type: "challenge"; id: string; challenge: Challenge }
  | { type: "reflection"; id: string; prompt: string; min_chars?: number; required?: boolean };

export interface ActivityResult {
  response: unknown;
  correct: boolean | null;
  attempts: number;
  explanation?: string;
  answer?: string | string[];
}

export interface Completion {
  complete: boolean;
  missing: { block_id: string; type: string; reason: string }[];
  passed_challenges: string[];
}

export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  kind: LessonSummary["kind"];
  xp: number;
  estimated_minutes: number;
  objectives: string[];
  skills: { slug: string; name: string }[];
  world: { slug: string; title: string; theme: string };
  module: { slug: string; title: string };
  locked: boolean;
  lock_reason: string | null;
  blocks?: Block[];
  progress?: {
    status: string;
    current_block: number;
    drafts: Record<string, string>;
    responses: Record<string, ActivityResult>;
    hints: Record<string, Hint[]>;
    completion: Completion;
  };
  next_lesson?: { slug: string; title: string } | null;
}

export interface TestOutcome {
  test_id: number;
  name: string;
  visible: boolean;
  passed: boolean;
  message: string;
  stdin: string | null;
  expected: string | Record<string, unknown> | null;
  actual: string | Record<string, unknown> | null;
  error: { type: string; message: string; line: number | null } | null;
}

export interface Reward {
  first_pass: boolean;
  xp_awarded: { amount: number; reason: string }[];
  mastery: { skill: string; name: string; level: string }[];
  achievements: AchievementEarned[];
}

export interface AchievementEarned {
  slug: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
}

export interface Evaluation {
  submission_id: number;
  mode: "check" | "submit";
  attempt: number;
  passed: boolean;
  score?: number;
  breakdown?: Record<string, { weight: number; value: number }>;
  tests?: TestOutcome[];
  quality?: { rule: string; passed: boolean; message: string }[];
  timed_out?: boolean;
  summary?: { passed: number; total: number; hidden_total: number };
  robot?: RobotResult;
  reward?: Reward;
  grading: "deterministic";
}

export interface RobotResult {
  success: boolean;
  outcome: string;
  message: string;
  actions: number;
  blocks: number;
  trace: RobotTraceStep[];
}

export interface RobotTraceStep {
  action: string;
  ok?: boolean;
  note?: string;
  x: number;
  y: number;
  facing: "N" | "E" | "S" | "W";
  carrying: boolean;
  delivered: boolean;
}

export interface LessonCompleteResult extends Completion {
  completed: boolean;
  newly_completed?: boolean;
  xp_awarded?: { amount: number; reason: string }[];
  unlocked?: { slug: string; title: string }[];
  achievements?: AchievementEarned[];
  assessment?: Record<string, number | string | null>;
  level?: LevelInfo;
}

export interface LevelInfo {
  level: number;
  xp: number;
  level_floor: number;
  next_level_at: number;
  progress: number;
}

export interface Streak {
  current: number;
  longest: number;
  active_days_last_7: number;
  week: { date: string; active: boolean }[];
}

export interface SkillState {
  slug: string;
  name: string;
  description: string;
  world: string | null;
  level: "not_started" | "exploring" | "practising" | "developing" | "proficient" | "mastered";
  points: number;
}

export interface Dashboard {
  profile: Pick<Profile, "display_name" | "avatar" | "interests" | "specializations" | "guidance" | "interface_mode">;
  level: LevelInfo;
  streak: Streak;
  continue: { slug: string; title: string; summary: string; world: string; module: string } | null;
  current_world: string | null;
  worlds: World[];
  skills: SkillState[];
  recent_achievements: { slug: string; title: string; icon: string; earned_at: string }[];
  projects: { id: number; title: string; tests_passed: number; tests_total: number; updated_at: string }[];
  recent_xp: { amount: number; reason: string; created_at: string }[];
  recommendations: { kind: string; title: string; href: string; reason: string }[];
}

export interface Achievement {
  slug: string;
  title: string;
  description: string;
  criteria: string;
  icon: string;
  xp: number;
  earned: boolean;
  earned_at: string | null;
}

export interface PortfolioEntry {
  id: number;
  title: string;
  problem: string;
  technologies: string[];
  features: string[];
  code: string;
  tests_passed: number;
  tests_total: number;
  reflection: string;
  repository_url: string;
  deployment_url: string;
  is_public: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TutorStatus {
  available: boolean;
  provider: string;
  model: string | null;
  message: string | null;
  daily_limit: number;
}
