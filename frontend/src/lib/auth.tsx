import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { User } from './types';

interface AuthCtx { user: User | null; loading: boolean; signedOut: boolean; login(email: string, password: string): Promise<User>; register(b: { email: string; password: string; fullName: string; dateOfBirth: string }): Promise<User>; logout(): Promise<void> }
const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false); // true after an explicit sign-out: don't remember the last page for the next sign-in
  const qc = useQueryClient();

  useEffect(() => {
    api<{ user: User }>('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } });
    qc.clear(); setSignedOut(false); setUser(r.user); return r.user;
  }, [qc]);
  const register = useCallback(async (b: { email: string; password: string; fullName: string; dateOfBirth: string }) => {
    const r = await api<{ user: User }>('/auth/register', { method: 'POST', body: b });
    qc.clear(); setUser(r.user); return r.user;
  }, [qc]);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST' }).catch(() => undefined); qc.clear(); setSignedOut(true); setUser(null); }, [qc]);

  const value = useMemo(() => ({ user, loading, signedOut, login, register, logout }), [user, loading, signedOut, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
