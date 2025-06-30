import { supabase, executeQuery } from './supabase';
import type { Booking, UpdateBookingData, SejourStatus, ExtendedCreateBookingDataForServer, PersonDetails } from '../types/booking';
import { calculateBookingCost } from '../utils/bookingUtils';

export const bookingService = {
  async getAll(): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select(`*, profiles (full_name, family_name)`)
      .order('start_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getByUserId(userId: string): Promise<Booking[]> {

    const { data, error } = await supabase
      .from('bookings')
      .select(`*, profiles (full_name, family_name)`)
      .eq('user_id', userId)
      .order('start_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },


  async getById(id: string): Promise<{ data: Booking | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, profiles (full_name, family_name)`)
        .eq('id', id)
        .single();
      return { data, error };
    });
  },

  async getCurrentPricing() {
    const { data, error } = await supabase
      .from('pricing_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return { data, error };
  },

async create(userId: string, bookingData: ExtendedCreateBookingDataForServer): Promise<Booking> {

    const conflictCheck = await bookingService.checkDateConflict(userId, bookingData.start_date, bookingData.end_date);
    if (conflictCheck.hasConflict) {
      throw new Error(`Ces dates sont déjà réservées`);
    }

    const parsedPersons: PersonDetails[] = bookingData.persons_details.map(person => ({
      ...person,
      arrivalDate: person.arrivalDate ? new Date(person.arrivalDate) : null,
      departureDate: person.departureDate ? new Date(person.departureDate) : null
    }));

    const totalCost = await calculateBookingCost(
      parsedPersons,
    );

    // Fonction pour nettoyer undefined avant d'envoyer au jsonb
    function sanitizeForJson(value: any): any {
      if (Array.isArray(value)) {
        return value.map(sanitizeForJson);
      } else if (value && typeof value === 'object') {
        return Object.entries(value)
          .filter(([_, v]) => v !== undefined)
          .reduce((acc, [k, v]) => ({ ...acc, [k]: sanitizeForJson(v) }), {});
      } else {
        return value;
      }
    }

    const insertData = {
      user_id: userId,
      start_date: bookingData.start_date,
      end_date: bookingData.end_date,
      adults: bookingData.adults,
      children: bookingData.children,
      total_cost: totalCost,
      status: bookingData.status,
      arrival_time: bookingData.arrival_time,
      departure_time: bookingData.departure_time,
      booking_for_self: bookingData.booking_for_self,
      booking_for_name: bookingData.booking_for_name || null,
      booking_for_email: bookingData.booking_for_email || null,
      persons_details: sanitizeForJson(bookingData.persons_details),
      comments: bookingData.comments || null
    };

    console.log("👉 Insertion data préparée : ", JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from('bookings')
      .insert(insertData)
      .single();  // ❌ On enlève le select avec jointure ici !

    if (error) {
      console.error("❌ Erreur Supabase insert :", error);
      throw new Error(error?.message || 'Erreur lors de la création de la réservation');
    }

    console.log("✅ Insert réussi :", data);

    return data;
  },


  async update(id: string, updates: UpdateBookingData): Promise<{ data: Booking | null; error: string | null }> {
    /*
    if (updates.start_date || updates.end_date) {
      const currentBooking = await this.getById(id);
      if (currentBooking.error || !currentBooking.data) return { data: null, error: 'Réservation introuvable' };

      const startDate = updates.start_date || currentBooking.data.start_date;
      const endDate = updates.end_date || currentBooking.data.end_date;

      const conflictCheck = await this.checkDateConflict(startDate, endDate, id);
      if (conflictCheck.error) return { data: null, error: conflictCheck.error };
      if (conflictCheck.hasConflict) return { data: null, error: 'Conflit de dates' };
    }
    */
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('bookings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(`*, profiles (full_name, family_name)`).single();
      return { data, error };
    });
  },

  async delete(id: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      return { error: error?.message || null };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  /*
  async updateStatus(id: string, status: SejourStatus): Promise<{ data: Booking | null; error: string | null }> {
    return this.update(id, { status });
  },*/

    async updateStatus(id: string, status: SejourStatus): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    return { error: error?.message || null };
  },

  async confirm(id: string): Promise<{ error: string | null }> {
    return this.updateStatus(id, 'paid');
  },

  async cancel(id: string): Promise<{ error: string | null }> {
    return this.updateStatus(id, 'cancelled');
  },


  async checkDateConflict(userId: string, startDate: string, endDate: string, excludeBookingId?: string): Promise<{ hasConflict: boolean; error: string | null }> {
    try {
      let query = supabase
        .from('bookings')
        .select('id, start_date, end_date')
        .eq('user_id', userId)
        .neq('status', 'cancelled')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

      if (excludeBookingId) {
        query = query.neq('id', excludeBookingId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Erreur lors de checkDateConflict :", error);
        return { hasConflict: false, error: error.message };
      }

      return { hasConflict: !!(data && data.length > 0), error: null };

    } catch (error: any) {
      return { hasConflict: false, error: error.message };
    }
  },


  async getByDateRange(startDate: string, endDate: string): Promise<{ data: Booking[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, profiles (full_name, family_name)`)
        .gte('start_date', startDate)
        .lte('end_date', endDate)
        .order('start_date', { ascending: true });
      return { data: data || [], error };
    });
  },

  async getStats(): Promise<{
    data: {
      total: number;
      confirmed: number;
      pending: number;
      cancelled: number;
      totalRevenue: number;
    } | null;
    error: string | null;
  }> {
    return executeQuery(async () => {
      const { data, error } = await supabase.from('bookings').select('status, total_cost');
      if (error || !data) return { data: null, error };

      const stats = data.reduce(
        (acc, booking) => {
          acc.total++;
          if (booking.status === 'completed') {
            acc.confirmed++;
            acc.totalRevenue += booking.total_cost || 0;
          } else if (booking.status === 'pending') {
            acc.pending++;
          } else if (booking.status === 'cancelled') {
            acc.cancelled++;
          }
          return acc;
        },
        { total: 0, confirmed: 0, pending: 0, cancelled: 0, totalRevenue: 0 }
      );

      return { data: stats, error: null };
    });
  }
};
