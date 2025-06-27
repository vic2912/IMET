// src/services/auth.ts
import { supabase, executeQuery } from './supabase';
import { User, LoginCredentials, SignupData } from '../types';

export const authService = {
  // Obtenir l'utilisateur actuel
  async getCurrentUser(): Promise<{ data: User | null; error: string | null }> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return { data: null, error: null };
    }

    return this.getUserProfile(session.user.id);
  },

  // Obtenir le profil utilisateur
  async getUserProfile(userId: string): Promise<{ data: User | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      return { data, error };
    });
  },

  // Connexion
  async signIn(credentials: LoginCredentials): Promise<{ data: User | null; error: string | null }> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (authError) {
        return { data: null, error: authError.message };
      }

      if (authData.user) {
        return this.getUserProfile(authData.user.id);
      }

      return { data: null, error: 'Erreur lors de la connexion' };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  },

  // Inscription
  async signUp(signupData: SignupData): Promise<{ data: User | null; error: string | null }> {
    try {
      // 1. Créer le compte utilisateur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
      });

      if (authError) {
        return { data: null, error: authError.message };
      }

      if (!authData.user) {
        return { data: null, error: 'Erreur lors de la création du compte' };
      }

      // 2. Créer le profil utilisateur
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: signupData.email,
          full_name: signupData.fullName,
          family_name: signupData.familyName,
          is_admin: false,
          is_active: true
        })
        .select()
        .single();

      if (profileError) {
        return { data: null, error: profileError.message };
      }

      return { data: profileData, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  },

  // Déconnexion
  async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      return { error: error?.message || null };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  // Écouter les changements d'authentification
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: user } = await this.getUserProfile(session.user.id);
        callback(user);
      } else {
        callback(null);
      }
    });
  },

  // Mettre à jour le profil
  async updateProfile(userId: string, updates: Partial<User>): Promise<{ data: User | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      return { data, error };
    });
  },

  // Changer le mot de passe
  async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      return { error: error?.message || null };
    } catch (error: any) {
      return { error: error.message };
    }
  }
};