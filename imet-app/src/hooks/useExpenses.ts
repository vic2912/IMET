// src/hooks/useExpenses.ts
import { useState, useEffect, useCallback } from 'react';
import { expenseService } from '../services';
import type { Expense, CreateExpenseData, UpdateExpenseData, ExpenseStatus } from '../types/expense';

export const useExpenses = (userId?: string) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les dépenses
  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = userId 
        ? await expenseService.getByUserId(userId)
        : await expenseService.getAll();
      
      if (error) {
        setError(error);
        return;
      }

      setExpenses(data || []);
    } catch (error: any) {
      setError(error.message || 'Erreur lors du chargement des dépenses');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Charger au montage du composant
  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Créer une dépense
  const createExpense = async (userId: string, expenseData: CreateExpenseData) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await expenseService.create(userId, expenseData);
      
      if (error) {
        setError(error);
        return { success: false, error };
      }

      // Recharger la liste
      await loadExpenses();
      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la création de la dépense';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour une dépense
  const updateExpense = async (id: string, updates: UpdateExpenseData) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await expenseService.update(id, updates);
      
      if (error) {
        setError(error);
        return { success: false, error };
      }

      // Mettre à jour la liste locale
      setExpenses(prev => prev.map(expense => 
        expense.id === id ? data! : expense
      ));
      
      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la mise à jour de la dépense';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Supprimer une dépense
  const deleteExpense = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await expenseService.delete(id);
      
      if (error) {
        setError(error);
        return { success: false, error };
      }

      // Retirer de la liste locale
      setExpenses(prev => prev.filter(expense => expense.id !== id));
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de la suppression de la dépense';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Approuver une dépense (admin)
  const approveExpense = async (id: string, approvedBy: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await expenseService.approve(id, approvedBy);
      
      if (error) {
        setError(error);
        return { success: false, error };
      }

      // Mettre à jour la liste locale
      setExpenses(prev => prev.map(expense => 
        expense.id === id ? data! : expense
      ));
      
      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de l\'approbation de la dépense';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Rejeter une dépense (admin)
  const rejectExpense = async (id: string, rejectedBy: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await expenseService.reject(id, rejectedBy);
      
      if (error) {
        setError(error);
        return { success: false, error };
      }

      // Mettre à jour la liste locale
      setExpenses(prev => prev.map(expense => 
        expense.id === id ? data! : expense
      ));
      
      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors du rejet de la dépense';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Charger les dépenses en attente (admin)
  const loadPendingExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await expenseService.getPending();
      
      if (error) {
        setError(error);
        return { success: false, error };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors du chargement des dépenses en attente';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Obtenir les statistiques
  const getStats = () => {
    const total = expenses.length;
    const pending = expenses.filter(e => e.status === 'pending').length;
    const approved = expenses.filter(e => e.status === 'approved').length;
    const rejected = expenses.filter(e => e.status === 'rejected').length;
    
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalApproved = expenses
      .filter(e => e.status === 'approved')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalPending = expenses
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + e.amount, 0);

    // Statistiques par catégorie
    const byCategory = expenses.reduce((acc, expense) => {
      if (!acc[expense.category]) {
        acc[expense.category] = 0;
      }
      acc[expense.category] += expense.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      pending,
      approved,
      rejected,
      totalAmount,
      totalApproved,
      totalPending,
      byCategory
    };
  };

  // Obtenir les dépenses par statut
  const getExpensesByStatus = (status: ExpenseStatus) => {
    return expenses.filter(expense => expense.status === status);
  };

  // Obtenir les dépenses par catégorie
  const getExpensesByCategory = (category: string) => {
    return expenses.filter(expense => expense.category === category);
  };

  // Obtenir les dépenses récentes
  const getRecentExpenses = (limit?: number) => {
    const recent = [...expenses]
      .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
    
    return limit ? recent.slice(0, limit) : recent;
  };

  const clearError = () => {
    setError(null);
  };

  return {
    // État
    expenses,
    loading,
    error,
    
    // Actions
    loadExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    rejectExpense,
    loadPendingExpenses,
    clearError,
    
    // Utilitaires
    stats: getStats(),
    pendingExpenses: getExpensesByStatus('pending'),
    approvedExpenses: getExpensesByStatus('approved'),
    rejectedExpenses: getExpensesByStatus('rejected'),
    getExpensesByStatus,
    getExpensesByCategory,
    getRecentExpenses
  };
};