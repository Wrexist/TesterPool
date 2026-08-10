'use client';

/**
 * Live credit balance. Credits move from actions taken elsewhere — a tester
 * checking in against your app, a tithe from a referral — so the sidebar number
 * refreshes on focus and on a slow interval rather than only on navigation.
 */

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { CreditChip } from '@/components/ui';

export function CreditBalance({ userId, initial }: { userId: string; initial: number }) {
  const [balance, setBalance] = React.useState(initial);
  const [bumped, setBumped] = React.useState(false);
  const [lastServerValue, setLastServerValue] = React.useState(initial);

  // A navigation brings a fresh server number. Reconcile during render rather
  // than in an effect so there is no flash of the stale balance.
  if (lastServerValue !== initial) {
    setLastServerValue(initial);
    setBalance(initial);
  }

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function read() {
      const { data } = await supabase.from('profiles').select('credits').eq('id', userId).maybeSingle();
      const next = data?.credits;
      if (cancelled || typeof next !== 'number') return;
      setBalance((prev) => {
        if (next !== prev) {
          setBumped(true);
          setTimeout(() => setBumped(false), 400);
        }
        return next;
      });
    }

    const timer = setInterval(read, 45_000);
    window.addEventListener('focus', read);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', read);
    };
  }, [userId]);

  return (
    <span className={bumped ? 'animate-pop' : undefined}>
      <CreditChip amount={balance} size="sm" />
    </span>
  );
}
