// supabaseConfig.js
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2'

// REMPLACEZ ces valeurs par les vôtres depuis le dashboard Supabase
const supabaseUrl = 'https://nhgsvsabbphzbekxwinq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZ3N2c2FiYnBoemJla3h3aW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NTgyNTMsImV4cCI6MjA2NDUzNDI1M30.5nO04URWQIQVl99BdUclJaMtXU87qzPw10CAUDaW7CM'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ===================================
// FONCTIONS D'AUTHENTIFICATION
// ===================================

export async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export async function signUpUser(email, password, userData) {
  // 1. Créer l'utilisateur dans Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData // métadonnées utilisateur
    }
  })
  
  if (authError) return { data: null, error: authError }
  
  // 2. Créer l'entrée dans la table users
  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .insert([{
      id: authData.user.id,
      name: userData.name,
      email: email,
      year: userData.year,
      parent_id: userData.parent_id,
      role: userData.role || 'user'
    }])
    .select()
    .single()
  
  if (userError) return { data: null, error: userError }
  
  return { data: { auth: authData, user: userRecord }, error: null }
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, error }
  
  // Récupérer les infos complètes depuis la table users
  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()
  
  return { user: userRecord, error: userError }
}

// ===================================
// FONCTIONS POUR LES UTILISATEURS
// ===================================

export async function getUsers() {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      name,
      email,
      year,
      parent_id,
      role,
      active,
      created_at,
      parent:users!users_parent_id_fkey(name)
    `)
    .eq('active', true)
    .order('name')
  
  return { data, error }
}

export async function createUser(userData) {
  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single()
  
  return { data, error }
}

export async function updateUser(userId, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  
  return { data, error }
}

// ===================================
// FONCTIONS POUR LES ÉVÉNEMENTS
// ===================================

export async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select(`
      id,
      date_debut,
      date_fin,
      participants,
      nombre_participants,
      created_at,
      created_by:users!events_created_by_fkey(name)
    `)
    .order('date_debut', { ascending: false })
  
  return { data, error }
}

export async function createEvent(eventData) {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('events')
    .insert([{
      ...eventData,
      created_by: user?.id
    }])
    .select()
    .single()
  
  return { data, error }
}

export async function updateEvent(eventId, updates) {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single()
  
  return { data, error }
}

export async function deleteEvent(eventId) {
  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
  
  return { data, error }
}

// ===================================
// FONCTIONS UTILES
// ===================================

export async function getUserFamily(userId) {
  // Récupérer les enfants de l'utilisateur
  const { data: children, error } = await supabase
    .rpc('get_children', { user_id: userId })
  
  return { data: children, error }
}

export async function getEventsForWeek(startDate, endDate) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('date_debut', startDate)
    .lte('date_fin', endDate)
    .order('date_debut')
  
  return { data, error }
}
