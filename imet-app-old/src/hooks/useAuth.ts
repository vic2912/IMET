// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { authService } from '../services';
import { User, LoginCredentials, SignupData } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialiser l'authentification
  useEffect(() => {
    checkCurrentUser();
    
    // Écouter les changements d'authentification
    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkCurrentUser = async () => {
    try {
      setLoading(true);
      const { data: user } = await authService.getCurrentUser();
      setUser(user);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await authService.signIn(credentials);
      
      if (error) {
        setError(error);
        return { success: false, error };
      }

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
        setError(error);
        return { success: false, error };
      }

      setUser(data);
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
        setError(error);
        return { success: false, error };
      }

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
      setError(error);
      return { success: false, error };
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await authService.updateProfile(user.id, updates);
      
      if (error) {
        setError(error);
        return { success: false, error };
      }

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
    // État
    user,
    loading,
    error,
    isAuthenticated: !!user,
    
    // Actions
    signIn,
    signUp,
    signOut,
    updateProfile,
    clearError,
    
    // Utilitaires
    isAdmin: user?.is_admin || false,
    userId: user?.id || null
  };
};