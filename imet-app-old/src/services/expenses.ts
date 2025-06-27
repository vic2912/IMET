// src/services/expenses.ts
import { supabase, executeQuery } from './supabase';
import { Expense, CreateExpenseData, UpdateExpenseData } from '../types';

export const expenseService = {
  // Obtenir toutes les dépenses
  async getAll(): Promise<{ data: Expense[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles!expenses_user_id_fkey (
            full_name
          ),
          approved_by_profile:profiles!expenses_approved_by_fkey (
            full_name
          )
        `)
        .order('expense_date', { ascending: false });

      return { data: data || [], error };
    });
  },

  // Obtenir les dépenses d'un utilisateur
  async getByUserId(userId: string): Promise<{ data: Expense[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles!expenses_user_id_fkey (
            full_name
          ),
          approved_by_profile:profiles!expenses_approved_by_fkey (
            full_name
          )
        `)
        .eq('user_id', userId)
        .order('expense_date', { ascending: false });

      return { data: data || [], error };
    });
  },

  // Obtenir une dépense par ID
  async getById(id: string): Promise<{ data: Expense | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles!expenses_user_id_fkey (
            full_name
          ),
          approved_by_profile:profiles!expenses_approved_by_fkey (
            full_name
          )
        `)
        .eq('id', id)
        .single();

      return { data, error };
    });
  },

  // Créer une dépense
  async create(userId: string, expenseData: CreateExpenseData): Promise<{ data: Expense | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          user_id: userId,
          ...expenseData,
          status: 'pending'
        })
        .select(`
          *,
          profiles!expenses_user_id_fkey (
            full_name
          )
        `)
        .single();

      return { data, error };
    });
  },

  // Mettre à jour une dépense
  async update(id: string, updates: UpdateExpenseData): Promise<{ data: Expense | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          profiles!expenses_user_id_fkey (
            full_name
          ),
          approved_by_profile:profiles!expenses_approved_by_fkey (
            full_name
          )
        `)
        .single();

      return { data, error };
    });
  },

  // Supprimer une dépense
  async delete(id: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      return { error: error?.message || null };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  // Approuver une dépense
  async approve(id: string, approvedBy: string): Promise<{ data: Expense | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          profiles!expenses_user_id_fkey (
            full_name
          ),
          approved_by_profile:profiles!expenses_approved_by_fkey (
            full_name
          )
        `)
        .single();

      return { data, error };
    });
  },

  // Rejeter une dépense
  async reject(id: string, rejectedBy: string): Promise<{ data: Expense | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          status: 'rejected',
          approved_by: rejectedBy,
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          profiles!expenses_user_id_fkey (
            full_name
          ),
          approved_by_profile:profiles!expenses_approved_by_fkey (
            full_name
          )
        `)
        .single();

      return { data, error };
    });
  },

  // Obtenir les dépenses en attente d'approbation
  async getPending(): Promise<{ data: Expense[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles!expenses_user_id_fkey (
            full_name
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      return { data: data || [], error };
    });
  },

  // Obtenir les dépenses par catégorie
  async getByCategory(category: string): Promise<{ data: Expense[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles!expenses_user_id_fkey (
            full_name
          )
        `)
        .eq('category', category)
        .order('expense_date', { ascending: false });

      return { data: data || [], error };
    });
  },

  // Obtenir les dépenses par période
  async getByDateRange(startDate: string, endDate: string): Promise<{ data: Expense[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles!expenses_user_id_fkey (
            full_name
          )
        `)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false });

      return { data: data || [], error };
    });
  },

  // Obtenir les statistiques des dépenses
  async getStats(): Promise<{ 
    data: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      totalAmount: number;
      totalApproved: number;
      totalPending: number;
      byCategory: Record<string, number>;
    } | null; 
    error: string | null 
  }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('status, amount, category');

      if (error || !data) {
        return { data: null, error };
      }

      const stats = data.reduce((acc, expense) => {
        acc.total++;
        acc.totalAmount += expense.amount;

        // Par statut
        if (expense.status === 'approved') {
          acc.approved++;
          acc.totalApproved += expense.amount;
        } else if (expense.status === 'pending') {
          acc.pending++;
          acc.totalPending += expense.amount;
        } else if (expense.status === 'rejected') {
          acc.rejected++;
        }

        // Par catégorie
        if (!acc.byCategory[expense.category]) {
          acc.byCategory[expense.category] = 0;
        }
        acc.byCategory[expense.category] += expense.amount;

        return acc;
      }, {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalAmount: 0,
        totalApproved: 0,
        totalPending: 0,
        byCategory: {} as Record<string, number>
      });

      return { data: stats, error: null };
    });
  },

  // Upload d'un reçu (si vous voulez ajouter cette fonctionnalité plus tard)
  async uploadReceipt(file: File): Promise<{ data: string | null; error: string | null }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);

      if (uploadError) {
        return { data: null, error: uploadError.message };
      }

      const { data } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      return { data: data.publicUrl, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }
};