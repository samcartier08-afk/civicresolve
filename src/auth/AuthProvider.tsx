"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth, hasRealFirebaseConfig } from '../lib/firebase';
import { api } from '../lib/api';

export type Role = 'citizen' | 'authority' | 'admin';
export interface Me { role: Role; name: string }
interface LocalSessionUser { uid: string; email: string; displayName: string; role: Role }

interface StaffSession {
  token: string;
  account: { uid: string; role: 'authority' | 'admin'; name: string; email: string };
}

interface Ctx {
  user: (User | LocalSessionUser) | null;
  me: Me | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
  signOut: () => Promise<void>;
  signInDemo: (role: Role, name?: string, email?: string) => void;
  signInWithStaffKey: (accessKey: string) => Promise<StaffSession['account']>;
}

const DEMO_STORAGE_KEY = 'civicresolve_demo_user';
const STAFF_STORAGE_KEY = 'civicresolve_staff_session';
const AuthCtx = createContext<Ctx | null>(null);
export const homeFor = (r: Role) => (r === 'admin' ? '/admin' : r === 'authority' ? '/authority' : '/');

function readStaffSession(): StaffSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STAFF_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

function readDemoUser(): LocalSessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalSessionUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(User | LocalSessionUser) | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // 1. Check active Staff Portal session first
    const staff = readStaffSession();
    if (staff) {
      setUser({
        uid: staff.account.uid,
        email: staff.account.email,
        displayName: staff.account.name,
        role: staff.account.role,
      });
      setMe({ role: staff.account.role, name: staff.account.name });
      setLoading(false);
      return;
    }

    // 2. If real Firebase config is present, listen to Firebase Auth
    if (hasRealFirebaseConfig) {
      return onAuthStateChanged(auth, (u) => {
        if (readStaffSession()) return;
        setUser(u);
        if (!u) {
          setMe(null);
          setError(false);
          setLoading(false);
        }
      });
    }

    // 3. Local preview without Firebase keys: restore saved citizen session if any
    const savedDemo = readDemoUser();
    if (savedDemo) {
      setUser(savedDemo);
      setMe({ role: savedDemo.role, name: savedDemo.displayName });
    }
    setLoading(false);
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

  const signInWithStaffKey = async (accessKey: string): Promise<StaffSession['account']> => {
    const res = await fetch('/api/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid portal access key.');
    }
    const session: StaffSession = { token: data.token, account: data.account };
    try { sessionStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(session)); } catch { /* ignore */ }
    setUser({
      uid: session.account.uid,
      email: session.account.email,
      displayName: session.account.name,
      role: session.account.role,
    });
    setMe({ role: session.account.role, name: session.account.name });
    setError(false);
    setLoading(false);
    return session.account;
  };

  const signInDemo = (role: Role, name?: string, email?: string) => {
    const demo: LocalSessionUser = {
      uid: `local-${role}-${email || role}`,
      email: email || `${role}@civicresolve.local`,
      displayName: name || 'Citizen',
      role,
    };
    try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demo)); } catch { /* ignore */ }
    setUser(demo);
    setMe({ role: demo.role, name: demo.displayName });
    setError(false);
    setLoading(false);
  };

  const signOut = async () => {
    try {
      sessionStorage.removeItem(STAFF_STORAGE_KEY);
      localStorage.removeItem(DEMO_STORAGE_KEY);
    } catch { /* ignore */ }
    if (hasRealFirebaseConfig) {
      await fbSignOut(auth).catch(() => undefined);
    }
    setUser(null);
    setMe(null);
  };

  const value = useMemo<Ctx>(
    () => ({
      user,
      me,
      loading,
      error,
      retry: () => setTick((n) => n + 1),
      signOut,
      signInDemo,
      signInWithStaffKey,
    }),
    [user, me, loading, error],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}
