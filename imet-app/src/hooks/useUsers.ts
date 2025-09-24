import { useState, useEffect, useCallback } from 'react';
import { userService } from '../services/userService';
import type {
  User,
  CreateUserData,
  FamilyRelation,
  CreateFamilyRelationData
} from '../types/family';
import { useSnackbar } from 'notistack';

export const useUsers = (currentUserId?: string) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userDependents, setUserDependents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { enqueueSnackbar } = useSnackbar();
  const notifySuccess = (msg: string) => enqueueSnackbar(msg, { variant: 'success' });
  const notifyError = (msg: string) => enqueueSnackbar(msg, { variant: 'error' });

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await userService.getUsers(true);
      if (error) {
        setError(error);
        notifyError('Erreur lors du chargement des utilisateurs');
        return;
      }
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message);
      notifyError('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const loadCurrentUser = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { data: user, error: userError } = await userService.getUserById(currentUserId);
      if (!userError && user) {
        setCurrentUser(user);
      }
      const { data: dependents, error: depsError } = await userService.getUserDependents(currentUserId);
      if (!depsError && dependents) {
        setUserDependents(dependents);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement de l\'utilisateur:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadUsers();
    if (currentUserId) loadCurrentUser();
  }, [loadUsers, loadCurrentUser, currentUserId]);

  const createUser = async (userData: CreateUserData) => {
    try {
      const { data, error } = await userService.createUser(userData);
      if (error) {
        notifyError('Erreur lors de la création de l\'utilisateur');
        return null;
      }
      notifySuccess('Utilisateur créé avec succès');
      await loadUsers();
      return data;
    } catch (err: any) {
      notifyError(err.message);
      return null;
    }
  };

  const refreshUsers = async () => loadUsers();

  const getUserFamilyRelations = async (userId: string): Promise<FamilyRelation[]> => {
    const { data, error } = await userService.getUserFamilyRelations(userId);
    return error || !data ? [] : data;
  };

  const addFamilyRelation = async (relation: CreateFamilyRelationData) => {
    const { error } = await userService.addFamilyRelation(relation);
    if (error) {
      notifyError('Erreur lors de l\'ajout du lien familial');
    } else {
      notifySuccess('Lien familial ajouté');
    }
  };

  const removeFamilyRelation = async (relationId: string) => {
    const { error } = await userService.removeFamilyRelation(relationId);
    if (error) {
      notifyError('Erreur lors de la suppression du lien familial');
    } else {
      notifySuccess('Lien familial supprimé');
    }
  };

  const searchUsers = async (query: string): Promise<User[]> => {
    const { data, error } = await userService.searchUsers(query);
    return error || !data ? [] : data;
  };

  /**
   * Liste des personnes pour lesquelles l'utilisateur peut réserver (guardians)
   */
  const getReservableUsers = useCallback(async (userId: string): Promise<User[]> => {
    try {
      const { data, error } = await userService.getUserFamilyRelations(userId);
      if (error || !data) return [];
      const relatedUserIds = data
        .filter(r => r.is_guardian || ['parent', 'child', 'spouse', 'sibling'].includes(r.relationship_type))
        .map(r => r.related_user_id);
      const { data: allUsers, error: userError } = await userService.getUsers();
      if (userError || !allUsers) return [];
      return allUsers.filter(u => relatedUserIds.includes(u.id));
    } catch {
      return [];
    }
  }, []);

  const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await userService.getUsers(true);
    return error || !data ? [] : data;
  };

  return {
    users,
    currentUser,
    userDependents,
    loading,
    error,
    createUser,
    refreshUsers,
    getReservableUsers,
    getUserFamilyRelations,
    addFamilyRelation,
    removeFamilyRelation,
    searchUsers,
    getAllUsers
  };
};
