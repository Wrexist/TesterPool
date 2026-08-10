import { ImageResponse } from 'next/og';
import { getGreenlight } from './greenlight';
import { RULES } from '@/lib/economy';

export const alt = 'Approved for production on Google Play';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/*
 * Token values, written literally: the OG renderer resolves no CSS variables.
 * These are the same hex codes declared in globals.css.
 */
const BG = '#0B0C0E';
const SURFACE = '#131519';
const LINE = '#252932';
const INK = '#F2F4F7';
const DIM = '#98A1B2';
const MUTE = '#6B7482';
const ACCENT = '#2BD97C';

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = await getGreenlight(slug);

  const stats: Array<[string, string]> = [
    [String(g.days), 'days held'],
    [String(g.testers), 'testers'],
    ...(g.feedback ? ([[String(g.feedback), 'feedback reports']] as Array<[string, string]>) : []),
    ...(g.engagement
      ? ([[`${g.engagement}%`, 'engagement']] as Array<[string, string]>)
      : ([[`${RULES.requiredTesters}+`, 'required']] as Array<[string, string]>)),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: `radial-gradient(900px 500px at 50% -10%, rgba(43,217,124,0.16), ${BG} 70%)`,
          padding: 64,
          fontFamily: 'sans-serif',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <svg width="44" height="44" viewBox="0 0 32 32">
              <g fill={ACCENT}>
                <circle cx="16" cy="4.4" r="2.5" />
                <circle cx="26" cy="10.2" r="2.5" />
                <circle cx="26" cy="21.8" r="2.5" />
                <circle cx="16" cy="27.6" r="2.5" />
                <circle cx="6" cy="21.8" r="2.5" />
                <circle cx="6" cy="10.2" r="2.5" />
                <circle cx="16" cy="16" r="3.4" fillOpacity="0.45" />
              </g>
            </svg>
            <span style={{ color: INK, fontSize: 30, fontWeight: 700, letterSpacing: -0.6 }}>
              TesterPool
            </span>
          </div>
          <span
            style={{
              display: 'flex',
              color: ACCENT,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              border: `1px solid rgba(43,217,124,0.35)`,
              background: 'rgba(43,217,124,0.10)',
              borderRadius: 999,
              padding: '10px 22px',
            }}
          >
            Approved for production
          </span>
        </div>

        {/* title block */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            {Array.from({ length: RULES.requiredDays }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: ACCENT,
                }}
              />
            ))}
          </div>
          <div
            style={{
              color: INK,
              fontSize: g.appName.length > 22 ? 76 : 96,
              fontWeight: 700,
              letterSpacing: -2.5,
              lineHeight: 1.02,
            }}
          >
            {g.appName}
          </div>
          <div style={{ color: DIM, fontSize: 30, marginTop: 16 }}>
            {g.tagline ??
              `${RULES.requiredTesters} testers held for ${g.days} consecutive days`}
          </div>
        </div>

        {/* stats */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {stats.map(([v, l]) => (
              <div
                key={l}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: SURFACE,
                  border: `1px solid ${LINE}`,
                  borderRadius: 14,
                  padding: '18px 26px',
                  minWidth: 180,
                }}
              >
                <span style={{ color: INK, fontSize: 42, fontWeight: 700, lineHeight: 1 }}>{v}</span>
                <span style={{ color: MUTE, fontSize: 19, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  {l}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {g.firstTry && (
              <span style={{ color: ACCENT, fontSize: 24, fontWeight: 700 }}>First try ✓</span>
            )}
            <span style={{ color: DIM, fontSize: 24, marginTop: 8 }}>
              {g.devHandle ? `@${g.devHandle}` : g.devName}
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
