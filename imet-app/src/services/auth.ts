// src/services/auth.ts
import { supabase, executeQuery } from './supabase';
import type { User, LoginCredentials, SignupData } from '../types/auth';

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

      if (authError) return { data: null, error: authError.message };
      if (!authData.user) return { data: null, error: 'Erreur lors de la connexion' };

      const userId = authData.user.id;

      // 1) Charger le profil existant (créé par le trigger)
      let { data: profile, error: loadErr } = await this.getUserProfile(userId);
      if (!profile) {
        // 2) Petit retry (le trigger peut être légèrement asynchrone)
        await new Promise(r => setTimeout(r, 300));
        ({ data: profile } = await this.getUserProfile(userId));
      }

      return { data: profile ?? null, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  },


  // Inscription (minimal : email + mot de passe)
  async signUp(signupData: SignupData): Promise<{ data: User | null; error: string | null }> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
          // Pas besoin d'envoyer full_name ici : on le demandera dans l'onboarding
        }
      });

      if (authError) return { data: null, error: authError.message };
      if (!authData.user) return { data: null, error: 'Erreur lors de la création du compte' };

      // On ne crée/écrit rien dans profiles ici (RLS) : le trigger s'en charge.
      return { data: null, error: null };
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
    return supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        callback(null);
        return;
      }

      const userId = session.user.id;

      // Tenter de charger le profil (créé par trigger)
      const tryLoad = async () => {
        let { data: u } = await this.getUserProfile(userId);
        if (u) return u;
        await new Promise(r => setTimeout(r, 250));
        ({ data: u } = await this.getUserProfile(userId));
        return u ?? null;
      };

      const user = await tryLoad();
      callback(user);
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