// src/hooks/useAdmin.ts

import { useState, useCallback } from 'react';
import { adminService } from '../services/admin';
import {
  User,
  PricingSettings,
  AdminStats,
  UpdatePricingData,
  ApiResponse
} from '../types/admin';
import { CreateUserData } from '../types/family';

interface UseAdminReturn {
  users: User[];
  pricingSettings: PricingSettings | null;
  stats: AdminStats;
  loading: boolean;
  error: string | null;
  loadUsers: () => Promise<void>;
  loadPricingSettings: () => Promise<void>;
  loadStats: () => Promise<void>;
  toggleUserAdmin: (userId: string, isAdmin: boolean) => Promise<ApiResponse>;
  deleteUser: (userId: string) => Promise<ApiResponse>;
  updatePricing: (data: UpdatePricingData) => Promise<ApiResponse>;
  createUser: (data: CreateUserData) => Promise<ApiResponse>; // ✔️ ajout
}

export const useAdmin = (): UseAdminReturn => {
  const [users, setUsers] = useState<User[]>([]);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalAdmins: 0,
    totalBookings: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    clearError();
    try {
      const response = await adminService.getUsers();
      if (response.success && response.data) {
        setUsers(response.data);
      } else {
        setError(response.error || 'Erreur lors du chargement des utilisateurs');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  const loadPricingSettings = useCallback(async () => {
    setLoading(true);
    clearError();
    try {
      const response = await adminService.getPricingSettings();
      if (response.success && response.data) {
        setPricingSettings(response.data);
      } else {
        setError(response.error || 'Erreur lors du chargement des tarifs');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des tarifs');
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    clearError();
    try {
      const response = await adminService.getStats();
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        setError(response.error || 'Erreur lors du chargement des statistiques');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  const toggleUserAdmin = useCallback(async (userId: string, isAdmin: boolean): Promise<ApiResponse> => {
    setLoading(true);
    clearError();
    try {
      const response = await adminService.toggleUserAdmin(userId, isAdmin);
      if (response.success) {
        await loadUsers();
      } else {
        setError(response.error || 'Erreur lors de la modification du statut');
      }
      return response;
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la modification du statut';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [loadUsers, clearError]);

  const deleteUser = useCallback(async (userId: string): Promise<ApiResponse> => {
    setLoading(true);
    clearError();
    try {
      const response = await adminService.deleteUser(userId);
      if (response.success) {
        await loadUsers();
      } else {
        setError(response.error || 'Erreur lors de la suppression');
      }
      return response;
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la suppression';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [loadUsers, clearError]);

  const updatePricing = useCallback(async (data: UpdatePricingData): Promise<ApiResponse> => {
    setLoading(true);
    clearError();
    try {
      const response = await adminService.updatePricing(data);
      if (response.success) {
        await loadPricingSettings();
      } else {
        setError(response.error || 'Erreur lors de la mise à jour des tarifs');
      }
      return response;
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la mise à jour des tarifs';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [loadPricingSettings, clearError]);

  const createUser = useCallback(async (data: CreateUserData): Promise<ApiResponse> => {
    setLoading(true);
    clearError();
    try {
      const response = await adminService.createUser(data);
      if (response.success) {
        await loadUsers();
      } else {
        setError(response.error || 'Erreur lors de la création');
      }
      return response;
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la création';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [loadUsers, clearError]);

  return {
    users,
    pricingSettings,
    stats,
    loading,
    error,
    loadUsers,
    loadPricingSettings,
    loadStats,
    toggleUserAdmin,
    deleteUser,
    updatePricing,
    createUser // ✔️ ajout final
  };
};
