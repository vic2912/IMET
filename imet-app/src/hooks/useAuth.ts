// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { authService } from '../services';
import type { User, LoginCredentials, SignupData } from '../types/auth';
import type { Session } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    //console.log('🔄 Initialisation du hook useAuth');
    initAuth();

    // Écoute les changements de session Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      //console.log(`🪄 Auth event: ${event}`);
      //console.log('📦 Nouvelle session:', session);
      setSession(session);

      if (!session) {
        console.warn('🚫 Session supprimée ou expirée');
        setUser(null);
      } else {
        checkCurrentUser(); // Resynchronise le profil utilisateur
      }
    });

    return () => {
      //console.log('🧹 Nettoyage de useAuth');
      subscription.unsubscribe();
    };
  }, []);

  const initAuth = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('❌ Erreur lors de getSession:', error.message);
      }
      setSession(data.session);

      if (data.session) {
        //console.log('✅ Session existante trouvée, chargement du profil');
        await checkCurrentUser();
      } else {
        //console.log('🕳️ Aucune session trouvée au chargement');
        setUser(null);
      }
    } catch (err: any) {
      console.error('❌ Erreur initAuth:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentUser = async () => {
    try {
      const { data: userData } = await authService.getCurrentUser();
      //console.log('👤 Profil utilisateur chargé:', userData);
      setUser(userData);
    } catch (err: any) {
      console.error('❌ Erreur checkCurrentUser:', err.message);
      setUser(null);
    }
  };

  const signIn = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await authService.signIn(credentials);

      if (error) {
        console.error('❌ Erreur lors du login:', error);
        setError(error);
        return { success: false, error };
      }

      //console.log('✅ Connexion réussie:', data);
      setUser(data);
      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la connexion';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (signupData: SignupData) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await authService.signUp(signupData);

      if (error) {
        console.error('❌ Erreur lors du signup:', error);
        setError(error);
        return { success: false, error };
      }

      console.log('✅ Création de compte réussie');
      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la création du compte';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);

      const { error } = await authService.signOut();

      if (error) {
        console.error('❌ Erreur lors de la déconnexion:', error);
        setError(error);
        return { success: false, error };
      }

      //console.log('👋 Déconnexion réussie');
      setUser(null);
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la déconnexion';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) {
      const error = 'Aucun utilisateur connecté';
      console.warn('⚠️ Tentative de mise à jour sans utilisateur');
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await authService.updateProfile(user.id, updates);

      if (error) {
        console.error('❌ Erreur mise à jour profil:', error);
        setError(error);
        return { success: false, error };
      }

      //console.log('✅ Profil mis à jour');
      setUser(data);
      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la mise à jour du profil';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    user,
    session,
    loading,
    error,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    updateProfile,
    clearError,
    isAdmin: user?.is_admin || false,
    userId: user?.id || null,
    setUser,
  };
};
