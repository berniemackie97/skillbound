'use client';

import { useEffect, useState } from 'react';

import { ExchangeClient } from './exchange-client';
import type { ExchangeClientProps } from './exchange-client.types';

type NavSessionResponse = {
  user: { id: string; name?: string | null; email?: string | null } | null;
};

const emptySession: NavSessionResponse = { user: null };

type ExchangeClientShellProps = Omit<ExchangeClientProps, 'isSignedIn'>;

export function ExchangeClientShell({
  initialItems,
  initialMeta,
}: ExchangeClientShellProps) {
  const [session, setSession] = useState<NavSessionResponse>(emptySession);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const response = await fetch('/api/nav/session', {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (active) setSession(emptySession);
          return;
        }
        const payload = (await response.json()) as NavSessionResponse;
        if (active) {
          setSession({ user: payload.user ?? null });
        }
      } catch {
        if (active) setSession(emptySession);
      }
    };

    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  return (
    <ExchangeClient
      initialItems={initialItems}
      initialMeta={initialMeta}
      isSignedIn={Boolean(session.user?.id)}
    />
  );
}
