import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  user: User | null;
  client: SupabaseClient | null;
  message: string | null;
  error: string | null;
  sendMagicLink: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearFeedback: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    void getSupabaseClient().then((loadedClient) => {
      if (active) setClient(loadedClient);
    }).catch((clientError) => {
      if (!active) return;
      setError(clientError instanceof Error ? clientError.message : 'Account service could not start.');
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!client) return undefined;
    let active = true;
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setError(sessionError?.message ?? null);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const sendMagicLink = useCallback(async (email: string) => {
    if (!client) return false;
    setError(null);
    setMessage(null);
    const { error: signInError } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });
    if (signInError) {
      setError(signInError.message);
      return false;
    }
    setMessage('Check your email for a secure sign-in link.');
    return true;
  }, [client]);

  const signOut = useCallback(async () => {
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else {
      setMessage('Signed out. This device keeps its local workspace.');
      setUser(null);
    }
  }, [client]);

  const clearFeedback = useCallback(() => {
    setError(null);
    setMessage(null);
  }, []);

  return <AuthContext.Provider value={{
    configured: isSupabaseConfigured,
    loading,
    user,
    client,
    message,
    error,
    sendMagicLink,
    signOut,
    clearFeedback,
  }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
