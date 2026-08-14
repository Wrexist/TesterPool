/**
 * Shared loader for the greenlight share page and its Open Graph image.
 * Never throws: an unfurled link that 500s is worse than a generic card.
 */
import { createClient } from '@/lib/supabase/server';
import { RULES } from '@/lib/economy';

export type GreenlightView = {
  slug: string;
  appName: string;
  tagline: string | null;
  days: number;
  testers: number;
  feedback: number;
  engagement: number;
  firstTry: boolean;
  approvedAt: string | null;
  devName: string;
  devHandle: string | null;
  found: boolean;
};

type Row = {
  slug: string;
  days: number | null;
  testers_count: number | null;
  feedback_count: number | null;
  engagement_pct: number | null;
  first_try: boolean | null;
  approved_at: string | null;
  apps: { name: string; tagline: string | null } | null;
  profiles: { handle: string; display_name: string } | null;
};

function titleFromSlug(slug: string) {
  const cleaned = slug.replace(/[-_]+/g, ' ').trim();
  if (!cleaned || /^[0-9a-f]{6,}$/i.test(cleaned)) return 'This app';
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fallbackGreenlight(slug: string): GreenlightView {
  return {
    slug,
    appName: titleFromSlug(slug),
    tagline: null,
    days: RULES.requiredDays,
    testers: RULES.cycleSize,
    feedback: 0,
    engagement: 0,
    firstTry: false,
    approvedAt: null,
    devName: 'A TesterPool developer',
    devHandle: null,
    found: false,
  };
}

export async function getGreenlight(slug: string): Promise<GreenlightView> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('greenlights')
      .select(
        'slug, days, testers_count, feedback_count, engagement_pct, first_try, approved_at,' +
          ' apps(name, tagline), profiles(handle, display_name)'
      )
      .eq('slug', slug)
      .eq('is_public', true)
      .maybeSingle();

    if (error || !data) return fallbackGreenlight(slug);

    const r = data as unknown as Row;
    return {
      slug: r.slug,
      appName: r.apps?.name ?? titleFromSlug(slug),
      tagline: r.apps?.tagline ?? null,
      days: r.days ?? RULES.requiredDays,
      testers: r.testers_count ?? 0,
      feedback: r.feedback_count ?? 0,
      engagement: r.engagement_pct ?? 0,
      firstTry: r.first_try ?? false,
      approvedAt: r.approved_at,
      devName: r.profiles?.display_name || r.profiles?.handle || 'A TesterPool developer',
      devHandle: r.profiles?.handle ?? null,
      found: true,
    };
  } catch {
    return fallbackGreenlight(slug);
  }
}
