// src/services/supabase.ts - Version minimale qui ne plante pas le serveur
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const supabaseUrl = 'https://dcydlyjmfhzhjtjtjcoo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjeWRseWptZmh6aGp0anRqY29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMjE1ODEsImV4cCI6MjA2NDY5NzU4MX0.2kGRkaRNeb9mOy594oVc-__roIvWUNAVbedBTXEkiKs';

// Création du client Supabase (sans tests automatiques)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Simple log de démarrage
console.log('📦 Client Supabase initialisé');

// Types pour les réponses Supabase
export interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
}

export interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseError | null;
}

// Fonction utilitaire pour gérer les erreurs
export const handleSupabaseError = (error: any): string => {
  if (error?.message) {
    return error.message;
  }
  return 'Une erreur inattendue s\'est produite';
};

// Fonction utilitaire simple pour les requêtes
export const executeQuery = async <T>(
  queryFn: () => Promise<SupabaseResponse<T>>,
  timeoutMs: number = 8000
): Promise<{ data: T | null; error: string | null }> => {
  try {
    // Promesse de timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout après ${timeoutMs}ms`)), timeoutMs);
    });

    // Course entre la requête et le timeout
    const result = await Promise.race([
      queryFn(),
      timeoutPromise
    ]);
    
    if (result.error) {
      return {
        data: null,
        error: handleSupabaseError(result.error)
      };
    }
    
    return {
      data: result.data,
      error: null
    };
  } catch (error: any) {
    return {
      data: null,
      error: handleSupabaseError(error)
    };
  }
};

// Fonction de test manuel (à appeler depuis la console)
export const testSupabaseConnection = async () => {
  console.log('🔄 Test de connexion Supabase...');
  
  try {
    // Test 1: Auth
    const { data: session, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('❌ Auth error:', authError.message);
    } else {
      console.log('✅ Auth OK, session:', !!session.session);
    }

    // Test 2: Table profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    if (profilesError) {
      console.error('❌ Profiles error:', profilesError.message);
    } else {
      console.log('✅ Table profiles OK:', profiles);
    }

    // Test 3: Table bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('count', { count: 'exact', head: true });
    
    if (bookingsError) {
      console.error('❌ Bookings error:', bookingsError.message);
    } else {
      console.log('✅ Table bookings OK:', bookings);
    }

    // Test 4: Table expenses
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('count', { count: 'exact', head: true });
    
    if (expensesError) {
      console.error('❌ Expenses error:', expensesError.message);
    } else {
      console.log('✅ Table expenses OK:', expenses);
    }
    
    console.log('🏁 Tests terminés');
    
  } catch (error: any) {
    console.error('❌ Erreur critique:', error.message);
  }
};