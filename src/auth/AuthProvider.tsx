"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { api } from '../lib/api';

export type Role = 'citizen' | 'authority' | 'admin';
export interface Me { role: Role; name: string }
interface Ctx { user: User | null; me: Me | null; loading: boolean; error: boolean; retry: () => void; signOut: () => Promise<void> }

const AuthCtx = createContext<Ctx | null>(null);
export const homeFor = (r: Role) => (r === 'admin' ? '/admin' : r === 'authority' ? '/authority' : '/');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (!u) { setMe(null); setError(false); setLoading(false); }
      }),
    [],
  );

  // Role comes from the backend (DB), never from client-editable data.
  useEffect(() => {
    if (!user) return;
    let live = true;
    setLoading(true);
    setError(false);
    api<Me>('/api/me')
      .then((m) => live && setMe(m))
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [user, tick]);

  const value = useMemo<Ctx>(
    () => ({ user, me, loading, error, retry: () => setTick((n) => n + 1), signOut: () => fbSignOut(auth) }),
    [user, me, loading, error],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}
