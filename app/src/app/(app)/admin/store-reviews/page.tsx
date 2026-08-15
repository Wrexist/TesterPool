import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, EmptyState, CreditChip } from '@/components/ui';
import { Section, WarnBox, RowList, Row } from '@/components/admin/parts';
import { StarGlyph } from '@/components/app/app-row';
import { IconExternal, IconAlert } from '@/components/app/icons';
import { getFlags } from '@/lib/flags';
import { fmtRelative, n } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * The store-review audit.
 *
 * This exists because the rest of the admin surface answers "is the economy
 * healthy" and this question is different: what has this network paid people to
 * publish on a public store, under their own names, and who signed each one
 * off. It is the record you would be asked for, and it needs to be one screen
 * rather than a join somebody has to remember to write.
 *
 * Reads `store_review_audit`, which is `security_invoker` — RLS still decides
 * the rows, and an admin sees all of them because `is_mod()` says so.
 */

interface AuditRow {
  feedback_id: string;
  assignment_id: string;
  app_id: string;
  app_name: string;
  store_url: string | null;
  publisher_id: string;
  publisher_handle: string | null;
  tester_id: string;
  tester_handle: string | null;
  store_rating: number | null;
  store_review_text: string | null;
  store_review_url: string | null;
  feedback_status: string;
  creator_verdict: string | null;
  credits_awarded: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_proof_id: string | null;
  review_proof_status: string | null;
  dispute_id: string | null;
  dispute_status: string | null;
}

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'violet' | 'neutral'> = {
  submitted: 'amber',
  approved: 'green',
  arbitrated: 'green',
  disputed: 'violet',
  rejected: 'red',
};

export default async function AdminStoreReviewsPage() {
  const supabase = await createClient();
  const flags = await getFlags();

  const { data, error } = await supabase
    .from('store_review_audit')
    .select('*')
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(200);

  const rows = (data ?? []) as AuditRow[];

  const awaitingPublisher = rows.filter((r) => r.feedback_status === 'submitted');
  const awaitingModerator = rows.filter(
    (r) => r.dispute_status === 'open' || r.review_proof_status === 'pending' || r.review_proof_status === 'escalated'
  );
  const paid = rows.filter((r) => r.feedback_status === 'approved' || r.feedback_status === 'arbitrated');
  const paidCredits = paid.reduce((total, r) => total + n(r.credits_awarded), 0);

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Public store reviews"
        note="Every review this network has paid somebody to publish on a public store listing, with who approved it."
        right={
          <Pill tone={flags.store_reviews ? 'red' : 'neutral'}>
            {flags.store_reviews ? 'Feature ON' : 'Feature off'}
          </Pill>
        }
      >
        {/*
          The one warning on this surface, and it is not decoration. Everything
          below is an incentivised review under Google Play's policy and Apple's
          Guideline 1.2, and the person reading this screen is the one who can
          switch it off.
        */}
        <WarnBox tone={flags.store_reviews ? 'red' : 'amber'}>
          {flags.store_reviews ? (
            <>
              <strong>Store reviews are switched ON.</strong> Paying for a published store review
              is an incentivised review under Google Play&rsquo;s Ratings, Reviews and Installs
              policy and Apple&rsquo;s Guideline 1.2 — for the reviewer&rsquo;s account and for the
              publisher&rsquo;s. Turning it off in{' '}
              <Link href="/admin/flags" className="underline">flags</Link> stops new ones
              immediately; it does not retract anything already published, and nothing here can.
            </>
          ) : (
            <>
              Store reviews are switched off, so nothing new can be filed. The rows below are
              historical. Enabling this in{' '}
              <Link href="/admin/flags" className="underline">flags</Link> re-opens paying for
              published public reviews — read the header of the migration first.
            </>
          )}
        </WarnBox>

        {error && (
          <div className="mt-3">
            <WarnBox tone="red">store_review_audit could not be read: {error.message}</WarnBox>
          </div>
        )}
      </Section>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing has been published"
          body="No store review has been filed on this network. While the feature is off, this stays true."
        />
      ) : (
        <>
          <Section title="Counts" note="Read live from the audit view.">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { l: 'Published', v: rows.length, sub: 'all time' },
                { l: 'Awaiting publisher', v: awaitingPublisher.length, sub: 'unreviewed' },
                { l: 'Awaiting a moderator', v: awaitingModerator.length, sub: 'disputes and proofs' },
                { l: 'Paid out', v: paidCredits, sub: `${paid.length} reviews` },
              ].map((s) => (
                <Card key={s.l} className="p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                    {s.l}
                  </div>
                  <div className="num mt-1 text-2xl font-bold">{s.v}</div>
                  <div className="mt-0.5 text-xs text-[var(--color-mute)]">{s.sub}</div>
                </Card>
              ))}
            </div>
          </Section>

          {awaitingModerator.length > 0 && (
            <Section
              title="Needs a moderator"
              note="A disputed review, or a screenshot nobody has verified. Both are decided in Moderation."
            >
              <RowList>
                {awaitingModerator.slice(0, 20).map((r) => (
                  <Row key={r.feedback_id} href="/admin/moderation">
                    <Pill tone={r.dispute_status === 'open' ? 'violet' : 'amber'}>
                      {r.dispute_status === 'open' ? 'Disputed' : 'Proof unverified'}
                    </Pill>
                    <span className="text-sm font-medium">{r.app_name}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-mute)]">
                      @{r.tester_handle ?? 'unknown'} · {fmtRelative(r.submitted_at)}
                    </span>
                  </Row>
                ))}
              </RowList>
            </Section>
          )}

          <Section title="Every published review" note="Newest first, capped at 200.">
            <div className="flex flex-col gap-3">
              {rows.map((r) => (
                <AuditCard key={r.feedback_id} row={r} />
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function AuditCard({ row }: { row: AuditRow }) {
  const rating = n(row.store_rating);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/market/${row.app_id}`} className="text-[15px] font-semibold hover:underline">
              {row.app_name}
            </Link>
            <Pill tone={STATUS_TONE[row.feedback_status] ?? 'neutral'}>{row.feedback_status}</Pill>
            {row.dispute_status === 'open' && <Pill tone="violet">Dispute open</Pill>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-mute)]">
            <span>
              by{' '}
              <Link href={`/admin/users?q=${encodeURIComponent(row.tester_handle ?? '')}`} className="font-medium hover:underline">
                @{row.tester_handle ?? 'unknown'}
              </Link>
            </span>
            <span>
              for{' '}
              <Link href={`/admin/users?q=${encodeURIComponent(row.publisher_handle ?? '')}`} className="font-medium hover:underline">
                @{row.publisher_handle ?? 'unknown'}
              </Link>
            </span>
            <span>{fmtRelative(row.submitted_at)}</span>
            {n(row.credits_awarded) > 0 && (
              <span className="inline-flex items-center gap-1">
                paid <CreditChip amount={n(row.credits_awarded)} size="sm" />
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} style={{ color: s <= rating ? '#F5A524' : 'var(--color-line-hi)' }}>
              <StarGlyph size={16} />
            </span>
          ))}
        </div>
      </div>

      <blockquote
        className="mt-3 whitespace-pre-wrap rounded-xl border-l-2 bg-[var(--color-surface-2)] px-4 py-3 text-sm leading-relaxed"
        style={{ borderLeftColor: 'var(--color-accent)' }}
      >
        {row.store_review_text}
      </blockquote>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="inline-flex items-center gap-1.5 text-[var(--color-mute)]">
          {row.review_proof_id ? (
            <>
              Screenshot{' '}
              <Pill tone={row.review_proof_status === 'approved' || row.review_proof_status === 'auto_approved' ? 'green' : 'amber'}>
                {row.review_proof_status ?? 'unknown'}
              </Pill>
            </>
          ) : (
            <>
              <IconAlert size={13} className="text-[var(--color-credit)]" /> No screenshot attached
            </>
          )}
        </span>
        {row.creator_verdict && (
          <span className="text-[var(--color-mute)]">
            publisher said <span className="font-medium text-[var(--color-dim)]">{row.creator_verdict}</span>
          </span>
        )}
        {row.store_review_url && (
          <a
            href={row.store_review_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
          >
            <IconExternal size={13} /> On the store
          </a>
        )}
      </div>
    </Card>
  );
}
