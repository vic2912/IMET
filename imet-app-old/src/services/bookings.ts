// src/services/bookings.ts

import { supabase, executeQuery } from './supabase';
import { Booking, UpdateBookingData, SejourStatus, ExtendedCreateBookingData } from '../types/booking';
import { format } from 'date-fns';

export const bookingService = {
  async getAll(): Promise<{ data: Booking[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, profiles (full_name, family_name)`)
        .order('start_date', { ascending: true });
      return { data: data || [], error };
    });
  },

  async getByUserId(userId: string): Promise<{ data: Booking[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, profiles (full_name, family_name)`)
        .eq('user_id', userId)
        .order('start_date', { ascending: true });
      return { data: data || [], error };
    });
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

  async create(userId: string, bookingData: ExtendedCreateBookingData): Promise<{ data: Booking | null; error: string | null }> {
    try {
      const conflictCheck = await this.checkDateConflict(bookingData.start_date, bookingData.end_date);
      if (conflictCheck.error) return { data: null, error: conflictCheck.error };
      if (conflictCheck.hasConflict) return { data: null, error: `Ces dates sont déjà réservées` };

      const pricing = await this.getCurrentPricing();
      if (pricing.error || !pricing.data) return { data: null, error: 'Erreur de tarif' };

      const startDate = new Date(bookingData.start_date);
      const endDate = new Date(bookingData.end_date);
      const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const cost = (bookingData.adults + bookingData.children) * pricing.data.night_price * nights;

      const insertData = {
        user_id: userId,
        start_date: bookingData.start_date,
        end_date: bookingData.end_date,
        adults: bookingData.adults,
        children: bookingData.children,
        total_cost: cost,
        status: 'planifié' as const,
        arrival_time: bookingData.arrival_time,
        departure_time: bookingData.departure_time,
        booking_for_self: bookingData.booking_for_self,
        booking_for_name: bookingData.booking_for_name || null,
        booking_for_email: bookingData.booking_for_email || null,
        persons_details: JSON.stringify(bookingData.persons_details),
        comments: bookingData.comments || null
      };

      const { data, error } = await supabase
        .from('bookings')
        .insert(insertData)
        .select(`*, profiles!bookings_user_id_fkey (full_name, email)`).single();

      return { data, error: error?.message || null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  },

  async update(id: string, updates: UpdateBookingData): Promise<{ data: Booking | null; error: string | null }> {
    if (updates.start_date || updates.end_date) {
      const currentBooking = await this.getById(id);
      if (currentBooking.error || !currentBooking.data) return { data: null, error: 'Réservation introuvable' };

      const startDate = updates.start_date || currentBooking.data.start_date;
      const endDate = updates.end_date || currentBooking.data.end_date;

      const conflictCheck = await this.checkDateConflict(startDate, endDate, id);
      if (conflictCheck.error) return { data: null, error: conflictCheck.error };
      if (conflictCheck.hasConflict) return { data: null, error: 'Conflit de dates' };
    }

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

  async updateStatus(id: string, status: SejourStatus): Promise<{ data: Booking | null; error: string | null }> {
    return this.update(id, { status });
  },

  async confirm(id: string): Promise<{ data: Booking | null; error: string | null }> {
    return this.updateStatus(id, 'payé');
  },

  async cancel(id: string): Promise<{ data: Booking | null; error: string | null }> {
    return this.updateStatus(id, 'cancelled');
  },

  async checkDateConflict(startDate: string, endDate: string, excludeBookingId?: string): Promise<{ hasConflict: boolean; error: string | null }> {
    try {
      let query = supabase
        .from('bookings')
        .select('id, start_date, end_date')
        .neq('status', 'cancelled')
        .or(`start_date.lte.${endDate},end_date.gte.${startDate}`);

      if (excludeBookingId) {
        query = query.neq('id', excludeBookingId);
      }

      const { data, error } = await query;
      return { hasConflict: !!(data && data.length > 0), error: error?.message || null };
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
          if (booking.status === 'confirmed') {
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
