"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth, hasRealFirebaseConfig } from '../lib/firebase';
import { api } from '../lib/api';

export type Role = 'citizen' | 'authority' | 'admin';
export interface Me { role: Role; name: string }
interface DemoUser { uid: string; email: string; displayName: string; role: Role }

interface Ctx {
  user: (User | DemoUser) | null;
  me: Me | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
  signOut: () => Promise<void>;
  signInDemo: (role: Role, name?: string, email?: string) => void;
}

const DEMO_STORAGE_KEY = 'civicresolve_demo_user';
const AuthCtx = createContext<Ctx | null>(null);
export const homeFor = (r: Role) => (r === 'admin' ? '/admin' : r === 'authority' ? '/authority' : '/');

function readDemoUser(): DemoUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(User | DemoUser) | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const savedDemo = readDemoUser();
    if (savedDemo) {
      setUser(savedDemo);
      setMe({ role: savedDemo.role, name: savedDemo.displayName });
      setLoading(false);
    }

    if (!hasRealFirebaseConfig) {
      if (!savedDemo) {
        // Default signed-in citizen session when Firebase credentials aren't configured yet
        const initial: DemoUser = {
          uid: 'local-citizen-1',
          email: 'citizen@civicresolve.local',
          displayName: 'Citizen',
          role: 'citizen',
        };
        try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initial)); } catch { /* ignore */ }
        setUser(initial);
        setMe({ role: 'citizen', name: 'Citizen' });
        setLoading(false);
      }
      return;
    }

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        const demo = readDemoUser();
        if (demo) {
          setUser(demo);
          setMe({ role: demo.role, name: demo.displayName });
        } else {
          setMe(null);
          setError(false);
        }
        setLoading(false);
      }
    });
  }, []);

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

  const signInDemo = (role: Role, name?: string, email?: string) => {
    const demo: DemoUser = {
      uid: `local-${role}-${email || role}`,
      email: email || `${role}@civicresolve.local`,
      displayName:
        name || (role === 'admin' ? 'Municipal Admin' : role === 'authority' ? 'Department Officer' : 'Citizen'),
      role,
    };
    try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demo)); } catch { /* ignore */ }
    setUser(demo);
    setMe({ role: demo.role, name: demo.displayName });
    setError(false);
    setLoading(false);
  };

  const signOut = async () => {
    try { localStorage.removeItem(DEMO_STORAGE_KEY); } catch { /* ignore */ }
    if (hasRealFirebaseConfig) {
      await fbSignOut(auth).catch(() => undefined);
    }
    setUser(null);
    setMe(null);
  };

  const value = useMemo<Ctx>(
    () => ({ user, me, loading, error, retry: () => setTick((n) => n + 1), signOut, signInDemo }),
    [user, me, loading, error],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}
