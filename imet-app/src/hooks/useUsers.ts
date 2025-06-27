import { useState, useEffect, useCallback } from 'react';
import { userService } from '../services/userService';
import type {
  User,
  CreateUserData,
  FamilyRelation,
  CreateFamilyRelationData
} from '../types/family';
import { useNotification } from './useNotification';

export const useUsers = (currentUserId?: string) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userDependents, setUserDependents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { showSuccess, showError } = useNotification();

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await userService.getUsers(true);
      if (error) {
        setError(error);
        showError('Erreur lors du chargement des utilisateurs');
        return;
      }
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message);
      showError('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, [showError]);

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
        showError('Erreur lors de la création de l\'utilisateur');
        return null;
      }
      showSuccess('Utilisateur créé avec succès');
      await loadUsers();
      return data;
    } catch (err: any) {
      showError(err.message);
      return null;
    }
  };

  const refreshUsers = async () => loadUsers();

  /**
   * Récupère les relations familiales dans les deux sens :
   * - relations définies par l'utilisateur
   * - relations définies par d'autres vers l'utilisateur
   * Toutes sont transformées pour que `related_user` désigne toujours "l'autre personne".
   */
  const getUserFamilyRelations = async (userId: string): Promise<FamilyRelation[]> => {
    const { data, error } = await userService.getUserById(userId);
    if (error || !data) return [];

    const direct = data.family_relations || [];

    const inverse = (data.related_to || []).map(r => ({
      ...r,
      id: `inverse-${r.id}`, // clé unique
      user_id: userId, // perspective de l'utilisateur courant
      related_user_id: r.user_id,
      relationship_type: r.relationship_type,
      is_guardian: r.is_guardian,
      created_at: r.created_at,
      updated_at: r.updated_at,
      related_user: r.user // injecte le profil de la personne liée
    }));

    return [...direct, ...inverse];
  };

  const addFamilyRelation = async (relation: CreateFamilyRelationData) => {
    const { error } = await userService.addFamilyRelation(relation);
    if (error) {
      showError('Erreur lors de l\'ajout du lien familial');
    } else {
      showSuccess('Lien familial ajouté');
    }
  };

  const removeFamilyRelation = async (relationId: string) => {
    const { error } = await userService.removeFamilyRelation(relationId);
    if (error) {
      showError('Erreur lors de la suppression du lien familial');
    } else {
      showSuccess('Lien familial supprimé');
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
