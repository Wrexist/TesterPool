/**
 * TESTERPOOL — hand-written row types for the shapes the app surface actually reads.
 *
 * These mirror `supabase/migrations/*.sql`. They are deliberately partial: only
 * the columns the authenticated product reads are listed, and everything the
 * database allows to be null is typed nullable, because this app is demoed
 * against a partially-populated database.
 */

export type Platform = 'android' | 'ios';
export type AppStatus = 'draft' | 'queued' | 'in_pod' | 'graduated' | 'paused' | 'rejected';
export type MembershipStatus =
  | 'invited' | 'joined' | 'opt_in_pending' | 'active' | 'dropped' | 'graduated' | 'removed';
export type ProofKind = 'opt_in' | 'daily_use' | 'uninstall_release';
export type ProofStatus = 'pending' | 'auto_approved' | 'approved' | 'rejected' | 'escalated';
export type FeedbackStatus = 'draft' | 'submitted' | 'approved' | 'disputed' | 'arbitrated' | 'rejected';
export type DisputeStatus = 'open' | 'upheld' | 'overturned' | 'withdrawn';
export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type LedgerReason =
  | 'signup_grant' | 'referral_bonus' | 'referral_tithe'
  | 'opt_in_verified' | 'daily_checkin' | 'streak_bonus'
  | 'feedback_approved' | 'bug_bounty' | 'rescue_bonus' | 'arbitration_award'
  | 'install_charge' | 'review_charge'
  | 'pod_seat_spend' | 'buffer_seat_spend' | 'rescue_seat_spend' | 'priority_spend'
  | 'expert_seat_spend' | 'extra_app_spend'
  | 'purchase' | 'refund' | 'admin_adjust' | 'penalty_dropout' | 'penalty_fraud';

export interface Profile {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
  timezone: string | null;
  tester_email: string | null;
  tester_email_verified_at: string | null;
  credits: number;
  reliability: number;
  tier: Tier;
  pods_completed: number;
  pods_dropped: number;
  apps_helped_ship: number;
  current_streak: number;
  longest_streak: number;
  referral_code: string;
  referred_by: string | null;
  is_moderator: boolean;
  is_banned: boolean;
  created_at: string;
}

export interface AppRow {
  id: string;
  owner_id: string;
  name: string;
  platform: Platform;
  package_name: string | null;
  store_url: string | null;
  icon_url: string | null;
  tagline: string | null;
  category: string | null;
  description: string | null;
  opt_in_url: string | null;
  /** Set when the owner's balance ran out mid-job. Cleared the moment it is positive again. */
  credits_paused: boolean;
  google_group: string | null;
  tester_instructions: string | null;
  focus_areas: string[] | null;
  min_android_version: string | null;
  status: AppStatus;
  graduated_at: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  /** Null for every seat taken off the feed. Nothing in the app reads it now. */
  pod_id: string | null;
  app_id: string;
  tester_id: string;
  status: MembershipStatus;
  opt_in_verified_at: string | null;
  days_checked_in: number;
  last_checkin_on: string | null;
  streak_broken: boolean;
  credits_escrowed: number;
  credits_paid: number;
  created_at: string;
}

export interface Proof {
  id: string;
  uploader_id: string;
  assignment_id: string | null;
  kind: ProofKind;
  storage_path: string;
  ai_verdict: Record<string, unknown> | null;
  ai_confidence: number | null;
  perceptual_hash: string | null;
  status: ProofStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface Checkin {
  id: string;
  assignment_id: string;
  day_number: number;
  checkin_date: string;
  proof_id: string | null;
  note: string | null;
  credits_awarded: number;
  created_at: string;
}

export interface Feedback {
  id: string;
  assignment_id: string;
  tester_id: string;
  app_id: string;
  device_model: string | null;
  os_version: string | null;
  score_usability: number | null;
  score_performance: number | null;
  score_clarity: number | null;
  first_impression: string | null;
  what_worked: string | null;
  what_broke: string | null;
  repro_steps: string | null;
  suggestion: string | null;
  severity: number | null;
  status: FeedbackStatus;
  creator_verdict: string | null;
  creator_note: string | null;
  reviewed_at: string | null;
  credits_awarded: number;
  submitted_at: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  feedback_id: string;
  raised_by: string;
  reason: string;
  status: DisputeStatus;
  resolver_id: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  user_id: string;
  delta: number;
  balance_after: number;
  reason: LedgerReason;
  ref_type: string | null;
  ref_id: string | null;
  memo: string | null;
  created_at: string;
}

export interface Greenlight {
  id: string;
  app_id: string;
  user_id: string;
  slug: string;
  testers_count: number;
  feedback_count: number;
  engagement_pct: number;
  days: number;
  first_try: boolean;
  is_public: boolean;
  approved_at: string;
}

export interface Badge {
  key: string;
  label: string;
  description: string;
  icon: string;
}

export interface UserBadge {
  user_id: string;
  badge_key: string;
  earned_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  credits_paid: number;
  activated_at: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------- views */

export interface LeaderboardRow {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  reliability: number;
  tier: Tier;
  pods_completed: number;
  apps_helped_ship: number;
  longest_streak: number;
  approved_reports: number;
}

/**
 * `pod_health` — one row per pack, with its fill and its progress.
 *
 * Back because Packs is back. `PodStatus` is inlined rather than restored as a
 * shared alias: this view is the only thing in the app that reads a pod's
 * status now, and a top-level type would invite a second reader.
 */
export interface PodHealthRow {
  id: string;
  code: string;
  name: string;
  status: 'forming' | 'locked' | 'active' | 'completed' | 'failed';
  core_seats: number;
  required_testers: number;
  starts_at: string | null;
  ends_at: string | null;
  day_index: number | null;
  members: number;
  dropouts: number;
  verified_optins: number;
  avg_days: number;
}

export interface ProductionEvidenceRow {
  app_id: string;
  owner_id: string;
  name: string;
  testers_assigned: number;
  testers_opted_in: number;
  testers_full_14: number;
  avg_days_active: number;
  feedback_reports: number;
  significant_issues: number;
  test_started: string | null;
  test_ends: string | null;
}

/** Uniform result shape every Server Action in this surface returns. */
export interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
}
