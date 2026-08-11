/**
 * TESTERPOOL — reading a store link.
 *
 * Pure functions, no I/O, so the parsing can be reasoned about and reused on
 * both sides of the wire. `lookupApp` in the Server Actions file does the
 * fetching and calls in here first.
 *
 * The thing worth understanding before changing any of this: **most apps
 * arriving at TesterPool have no public store page.** The product exists because
 * Google will not let a new personal developer account publish to production
 * until twelve testers have run the app for fourteen consecutive days, so the
 * app is in a closed track and `/store/apps/details?id=…` returns a 404.
 *
 * That is why parsing and fetching are separated here. Parsing a link yields the
 * package name and the opt-in URL deterministically, offline, every time — that
 * is the part users actually need. The fetch is a bonus that is genuinely absent
 * for the typical user and must never be presented as a failure.
 */

export type StorePlatform = 'android' | 'ios';

export interface ParsedAppLink {
  ok: boolean;
  platform: StorePlatform | null;
  /** Android package name, or iOS bundle id when the link carried one. */
  packageName: string | null;
  /** The numeric App Store id, which is what the iTunes API prefers. */
  appleId: string | null;
  /** Derived. For Android this is the closed-testing opt-in page. */
  optInUrl: string | null;
  /** The public listing, which may well not exist yet. */
  storeUrl: string | null;
  /** Shown to the user when `ok` is false. Always actionable. */
  reason: string;
}

const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;

function fail(reason: string): ParsedAppLink {
  return {
    ok: false, platform: null, packageName: null, appleId: null,
    optInUrl: null, storeUrl: null, reason,
  };
}

export function playOptInUrl(pkg: string): string {
  return `https://play.google.com/apps/testing/${pkg}`;
}

export function playStoreUrl(pkg: string): string {
  return `https://play.google.com/store/apps/details?id=${pkg}`;
}

export function appStoreUrl(appleId: string): string {
  return `https://apps.apple.com/app/id${appleId}`;
}

function android(pkg: string): ParsedAppLink {
  return {
    ok: true, platform: 'android', packageName: pkg, appleId: null,
    optInUrl: playOptInUrl(pkg), storeUrl: playStoreUrl(pkg),
    reason: 'Google Play package name read from the link.',
  };
}

function ios(appleId: string, bundleId: string | null = null): ParsedAppLink {
  return {
    ok: true, platform: 'ios', packageName: bundleId, appleId,
    // An iOS app has no equivalent of a Play opt-in URL. TestFlight invites are
    // issued per tester, so the developer supplies that separately.
    optInUrl: null, storeUrl: appStoreUrl(appleId),
    reason: 'App Store id read from the link.',
  };
}

/**
 * Accepts anything a developer is plausibly holding: a closed-testing opt-in
 * link, a public listing, an App Store share link, or a bare package name typed
 * from memory. Anything with no scheme is tried as a package name before being
 * rejected, because "com.ledgerly.app" is a reasonable thing to paste.
 */
export function parseAppLink(raw: string): ParsedAppLink {
  const input = raw.trim();
  if (!input) return fail('Paste the link to your app.');

  // No scheme: either a bare package name or a hostname-ish fragment.
  if (!/^https?:\/\//i.test(input)) {
    if (PACKAGE_RE.test(input)) return android(input.toLowerCase());
    if (/^id\d+$/i.test(input)) return ios(input.slice(2));
    if (/^\d{6,}$/.test(input)) return ios(input);
    if (/play\.google\.com|apps\.apple\.com/i.test(input)) {
      return parseAppLink(`https://${input}`);
    }
    return fail(
      'That is not a store link or a package name. A package name looks like com.ledgerly.app.'
    );
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return fail('That link is not a valid URL. Copy it again from the store.');
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname;

  /* ------------------------------------------------------------- Google Play */

  if (host === 'play.google.com') {
    // The closed-testing opt-in page. This is the link most users have.
    if (path.startsWith('/apps/testing/')) {
      const pkg = path.replace('/apps/testing/', '').replace(/\/+$/, '');
      if (!PACKAGE_RE.test(pkg)) {
        return fail('The package name in that opt-in link does not look valid.');
      }
      return android(pkg.toLowerCase());
    }

    // The public listing.
    if (path.startsWith('/store/apps/details')) {
      const pkg = url.searchParams.get('id')?.trim() ?? '';
      if (!PACKAGE_RE.test(pkg)) {
        return fail('That Play link has no package name in it. Check the ?id= part.');
      }
      return android(pkg.toLowerCase());
    }

    return fail('That is a Google Play link, but not to an app. Open your app and copy its link.');
  }

  /* ---------------------------------------------------------------- App Store */

  if (host === 'apps.apple.com' || host === 'itunes.apple.com') {
    // .../app/<slug>/id123456789 or .../app/id123456789
    const match = path.match(/\/id(\d+)/);
    if (match) return ios(match[1]);
    return fail('That App Store link has no app id in it. Use the share link from the App Store.');
  }

  /* ------------------------------------------------------------------- other */

  if (host === 'groups.google.com') {
    return fail(
      'That is your Google Group, which goes in its own field further down. Paste the app link here.'
    );
  }

  return fail('Paste a Google Play or App Store link, or your package name.');
}

/**
 * Google Play's own category codes, as they appear in the listing's JSON-LD,
 * mapped onto the categories this product offers. Anything unmapped falls
 * through to Other, which the user can change — a wrong pre-selection is worse
 * than an honest one.
 */
const PLAY_CATEGORY: Record<string, string> = {
  BUSINESS: 'Productivity',
  PRODUCTIVITY: 'Productivity',
  TOOLS: 'Utilities',
  FINANCE: 'Finance',
  HEALTH_AND_FITNESS: 'Health & Fitness',
  MEDICAL: 'Health & Fitness',
  EDUCATION: 'Education',
  EDUCATIONAL: 'Education',
  PHOTOGRAPHY: 'Photo & Video',
  VIDEO_PLAYERS: 'Photo & Video',
  SOCIAL: 'Social',
  COMMUNICATION: 'Social',
  TRAVEL_AND_LOCAL: 'Travel',
  MAPS_AND_NAVIGATION: 'Travel',
  MUSIC_AND_AUDIO: 'Music',
  PERSONALIZATION: 'Utilities',
  LIFESTYLE: 'Other',
};

/** The App Store's primary genre names, which are already human-readable. */
const APPLE_CATEGORY: Record<string, string> = {
  Business: 'Productivity',
  Productivity: 'Productivity',
  Utilities: 'Utilities',
  Finance: 'Finance',
  'Health & Fitness': 'Health & Fitness',
  Medical: 'Health & Fitness',
  Education: 'Education',
  Games: 'Games',
  Photo: 'Photo & Video',
  'Photo & Video': 'Photo & Video',
  'Social Networking': 'Social',
  Travel: 'Travel',
  Navigation: 'Travel',
  Music: 'Music',
};

/**
 * Guesses what testers should look at, from what the listing says the app does.
 *
 * A suggestion, not a decision — the chips stay editable and the user removes
 * what does not apply. Capped at four: ten pre-selected chips is the same as
 * none, because nobody edits a list that looks already considered.
 *
 * The two that are always suggested are the two that always apply. A tester's
 * first run is the only first run they get, and a crash ends the fourteen days
 * for everyone in the pod, not just the person who hit it.
 */
export function suggestFocusAreas(
  category: string | null | undefined,
  description: string | null | undefined
): string[] {
  const text = `${category ?? ''} ${description ?? ''}`.toLowerCase();
  const picked: string[] = ['First-run experience', 'Crashes and stability'];

  const signals: [RegExp, string][] = [
    [/\b(sign[ -]?up|sign[ -]?in|log[ -]?in|register|create an account|onboarding)\b/, 'Sign-up flow'],
    [/\b(subscription|subscribe|premium|paywall|pricing|free trial|in-app purchase|upgrade)\b/, 'Paywall and pricing'],
    [/\b(offline|no internet|sync|syncs|synchroni[sz])\b/, 'Offline behaviour'],
    [/\b(notification|reminder|alert|push)\b/, 'Notifications'],
    [/\b(dark mode|dark theme|light and dark)\b/, 'Dark mode'],
    [/\b(accessib|screen reader|talkback|voiceover|contrast)\b/, 'Accessibility'],
  ];

  for (const [pattern, area] of signals) {
    if (picked.length >= 4) break;
    if (pattern.test(text) && !picked.includes(area)) picked.push(area);
  }

  // Games live or die on frame rate long before they die on copy.
  if (picked.length < 4 && /^games?$/i.test(category ?? '')) {
    picked.push('Performance on low-end devices');
  }

  return picked.slice(0, 4);
}

export function normaliseCategory(raw: string | null | undefined): string {
  if (!raw) return '';
  const value = raw.trim();
  if (!value) return '';
  if (/^GAME(_|$)/i.test(value) || /^games?$/i.test(value)) return 'Games';
  const upper = value.toUpperCase().replace(/[\s&]+/g, '_');
  return PLAY_CATEGORY[upper] ?? APPLE_CATEGORY[value] ?? 'Other';
}
