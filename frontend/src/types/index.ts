export interface BulletDiff {
  bullet_id: string;
  section: string;
  original: string;
  tailored: string;
  keywords_added: string[];
  injected_keywords?: string[];
  action_verb_changed: boolean;
}

export interface Scores {
  match_percent: number;
  ats_score: number;
  strength_score: number;
}

export interface JDAnalysis {
  required_skills: string[];
  preferred_skills: string[];
  ats_keywords: string[];
  role_level: string;
  industry: string;
}

export interface EdgeCase {
  type: string;
  message: string;
  severity: "warning" | "info";
}

export interface RecentRole {
  company: string;
  role: string;
  dates: string;
}

export interface ContactInfo {
  email: string;
  phone: string;
  location: string;
  linkedin: string;
}

export interface ResumeSummary {
  name: string;
  title: string | null;
  summary: string | null;
  contact: ContactInfo;
  sections: string[];
  recent_roles: RecentRole[];
}

export interface TailorResponse {
  session_id: string;
  scores: Scores;
  jd_analysis: JDAnalysis;
  resume_summary: ResumeSummary;
  diff: BulletDiff[];
  edge_cases: EdgeCase[];
  total_bullets: number;
  changed_bullets: number;
}

export type TemplateId =
  | "jake"
  | "modern"
  | "soham"
  | "overleaf"
  | "executive"
  | "tech"
  | "swiss"
  | "crimson"
  | "compact";

export interface DownloadRequest {
  session_id: string;
  accepted_bullets: Record<string, string>; // bullet_id -> text or "original"
  user_id?: string;
  template_id?: TemplateId;
}

// Bullet state during review
export type BulletChoice = "accept" | "reject" | "edit";

export interface BulletState {
  choice: BulletChoice;
  editedText: string; // used when choice === "edit"
}

// App state machine
export type AppStep = "landing" | "dashboard" | "upload" | "tailor-setup" | "processing" | "review" | "cover-letter" | "done" | "admin" | "admin-feedback" | "resumes" | "templates" | "cover-letters" | "ai-review" | "settings";

export type Tier = "free" | "pro";
export type UpgradeReason = "tailor_limit" | "docx" | "cover_letter" | "history";

// Supabase history row
export interface HistoryEntry {
  id: string;
  created_at: string;
  session_id: string | null;
  original_filename: string | null;
  job_role: string | null;
  company: string | null;
  jd_snippet: string | null;
  match_percent: number | null;
  ats_score: number | null;
  strength_score: number | null;
  changed_bullets: number | null;
  total_bullets: number | null;
  response: TailorResponse | null;
}
