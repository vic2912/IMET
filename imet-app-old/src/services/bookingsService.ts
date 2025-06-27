import { supabase } from './supabase'; // Chemin de ton fichier supabase déjà existant
import { Booking, ExtendedCreateBookingData, UpdateBookingData, SejourStatus } from '../types/booking';

const tableName = 'bookings';

// ✅ Récupérer toutes les réservations
const getAll = async (): Promise<Booking[]> => {
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) throw error;
  return data || [];
};

// ✅ Récupérer les réservations d’un utilisateur
const getByUserId = async (userId: string): Promise<Booking[]> => {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
};

// ✅ Créer une réservation
const create = async (userId: string, bookingData: ExtendedCreateBookingData): Promise<Booking> => {
  const { data, error } = await supabase
    .from(tableName)
    .insert([{ ...bookingData, user_id: userId }])
    .single();
  if (error) throw error;
  return data;
};

// ✅ Mettre à jour une réservation
const update = async (id: string, updates: UpdateBookingData): Promise<Booking> => {
  const { data, error } = await supabase
    .from(tableName)
    .update(updates)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

// ✅ Supprimer une réservation
const deleteBooking = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// ✅ Mettre à jour le statut d’un séjour
const updateStatus = async (id: string, status: SejourStatus): Promise<Booking> => {
  return await update(id, { status });
};

export const bookingsService = {
  getAll,
  getByUserId,
  create,
  update,
  delete: deleteBooking,
  updateStatus
};
