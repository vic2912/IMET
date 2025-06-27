// src/services/admin.ts
import { supabase } from './supabase';
import { CreateUserData } from '../types/family';
import { ApiResponse } from '../types/admin';

export const adminService = {
  async getUsers() {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  async getPricingSettings() {
    const { data, error } = await supabase.from('pricing_settings').select('*').single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  async getStats() {
    const { data, error } = await supabase.rpc('get_admin_stats');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  async toggleUserAdmin(userId: string, isAdmin: boolean): Promise<ApiResponse> {
    const { error } = await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async deleteUser(userId: string): Promise<ApiResponse> {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async updatePricing(data: any): Promise<ApiResponse> {
    const { error } = await supabase.from('pricing_settings').update(data).eq('id', 1);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async createUser(user: CreateUserData): Promise<ApiResponse> {
    const { error: signUpError, data: signUpResult } = await supabase.auth.signUp({
      email: user.email,
      password: user.password
    });

    if (signUpError || !signUpResult?.user?.id) {
      return { success: false, error: signUpError?.message || 'Échec de la création de compte' };
    }

    const userId = signUpResult.user.id;

    const { error: insertError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      birth_date: user.birth_date,
      is_active: user.is_active,
      is_admin: user.role === 'admin'
    });

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    return { success: true };
  }
};
