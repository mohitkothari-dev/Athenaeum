import { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((prev) => {
        const next = session?.user ?? null;
        if (!next) return null;
        if (prev && prev.id === next.id) return prev;
        return next;
      });
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { error, session: data.session };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
    } catch (err) {
      console.warn('[auth] global signOut failed, falling back to local:', err);
      try {
        const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
        if (localError) throw localError;
      } catch (localErr) {
        console.warn('[auth] local signOut also failed, clearing storage manually:', localErr);
        // Ultimate fallback: manually purge Supabase auth storage so UI can recover even if API is 403
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('sb-') && k.includes('-auth-token'))) keysToRemove.push(k);
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
          // Also clear the standard supabase key pattern without sb- prefix fallback
          localStorage.removeItem('supabase.auth.token');
        } catch {
          /* ignore storage errors */
        }
      }
    } finally {
      // Force local state to signed-out even if server returned 403 (e.g., expired access_token / revocation forbidden).
      // onAuthStateChange will also fire, but this guarantees the UI unblocks immediately.
      setUser(null);
      setLoading(false);
    }
  }, []);

  return {
    user,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
  };
}
