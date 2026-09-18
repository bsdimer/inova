import { useRouter, type Href } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  bootstrapSession,
  getSession,
  logout as apiLogout,
  subscribeSession,
  type Session,
} from '../api/client';

export type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  refresh: () => Promise<Session | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(getSession());
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let mounted = true;
    void bootstrapSession().then(() => {
      if (!mounted) return;
      // Re-read the module store — login may have won a race with bootstrap.
      const next = getSession();
      setSession(next);
      setStatus(next ? 'authenticated' : 'guest');
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeSession(() => {
      const next = getSession();
      setSession(next);
      // Keep "loading" until bootstrap finishes; afterwards mirror the store.
      setStatus((prev) => {
        if (prev === 'loading') return prev;
        return next ? 'authenticated' : 'guest';
      });
    });
  }, []);

  const refresh = useCallback(async () => {
    const next = await bootstrapSession();
    setSession(next);
    setStatus(next ? 'authenticated' : 'guest');
    return next;
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setSession(null);
    setStatus('guest');
  }, []);

  const value = useMemo(
    () => ({ status, session, refresh, signOut }),
    [status, session, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

/** Redirects guests away from protected screens once bootstrap completes. */
export function useRequireAuth(redirectTo: Href = '/'): AuthContextValue {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'guest') {
      router.replace(redirectTo);
    }
  }, [auth.status, redirectTo, router]);

  return auth;
}

/** Redirects authenticated users away from guest-only screens (e.g. welcome). */
export function useRedirectIfAuthenticated(): AuthContextValue {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.session) return;
    router.replace(auth.session.user.mustSetPassword ? '/set-password' : '/home');
  }, [auth.status, auth.session, router]);

  return auth;
}
