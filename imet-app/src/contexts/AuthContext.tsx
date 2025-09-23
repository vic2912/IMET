// src/contexts/AuthContext.tsx
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { authService } from '../services';
import type { User, LoginCredentials, SignupData } from '../types/auth';
import type { Session } from '@supabase/supabase-js';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  userId: string | null;
  signIn: (c: LoginCredentials) => Promise<{ success: boolean; data?: User | null; error?: string | null }>;
  signUp: (s: SignupData) => Promise<{ success: boolean; data?: User | null; error?: string | null }>;
  signOut: () => Promise<{ success: boolean; error?: string | null }>;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; data?: User | null; error?: string | null }>;
  clearError: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
};

export const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAndSetCurrentUser = useCallback(async () => {
    try {
      const { data: u } = await authService.getCurrentUser();
      if (u) setUser(u);
      return u ?? null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const initAuth = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn('[Auth] getSession error:', error.message);
      setSession(data.session || null);
      if (data.session) {
        await getAndSetCurrentUser();
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [getAndSetCurrentUser]);

  useEffect(() => {
    // Initialisation
    initAuth();

    // Abonnement aux changements de session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setUser(null);
      } else {
        // Re-synchroniser le profil à chaque changement de session
        getAndSetCurrentUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [initAuth, getAndSetCurrentUser]);

  // Actions
  const signIn: AuthContextValue['signIn'] = async (c) => {
    try {
      setError(null);
      const { data, error } = await authService.signIn(c);
      if (error) {
        setError(error);
        return { success: false, error };
      }
      setUser(data ?? null);
      return { success: true, data: data ?? null };
    } finally {}
  };

  const signUp: AuthContextValue['signUp'] = async (s) => {
    try {
      setError(null);
      const { data, error } = await authService.signUp(s);
      if (error) {
        setError(error);
        return { success: false, error };
      }
      // Email de confirmation envoyé ; pas de user tant que pas confirmé
      return { success: true, data: null };
    } finally {}
  };

  const signOut: AuthContextValue['signOut'] = async () => {
    try {
      setError(null);
      const { error } = await authService.signOut();
      if (error) {
        setError(error);
        return { success: false, error };
      }
      setUser(null);
      return { success: true };
    } finally {}
  };

  const updateProfile: AuthContextValue['updateProfile'] = async (updates) => {
    if (!user) return { success: false, error: 'Aucun utilisateur connecté' };
    try {
      setError(null);
      const { data, error } = await authService.updateProfile(user.id, updates);
      if (error) {
        setError(error);
        return { success: false, error };
      }
      // 🔁 Très important : on met à jour le "store" global
      setUser(data ?? null);
      return { success: true, data: data ?? null };
    } finally {}
  };

  const clearError = () => setError(null);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: !!user?.is_admin,
    userId: user?.id ?? null,
    signIn,
    signUp,
    signOut,
    updateProfile,
    clearError,
    setUser,
  }), [user, session, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
