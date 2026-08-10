'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const DEMO_PASSWORD = 'testerpool-demo-1234';

export function DemoSignIn({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function go() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button className="btn btn-secondary" onClick={go} disabled={busy || !email}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      {error && <span className="max-w-[160px] text-right text-[10px] text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
