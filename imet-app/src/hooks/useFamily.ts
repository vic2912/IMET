import { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import type { FamilyRelation, RelationshipType, User } from '../types/family';

// On définit un type enrichi pour le closeFamily
export interface CloseFamilyMember extends User {
  relationship: RelationshipType;
  is_guardian: boolean;
}

export const useFamily = (userId: string) => {
  const [relations, setRelations] = useState<FamilyRelation[]>([]);

  useEffect(() => {
    const fetchRelations = async () => {
      if (!userId) return;
      const { data, error } = await userService.getUserFamilyRelations(userId);
      if (!error && data) {
        setRelations(data);
      }
    };

    fetchRelations();
  }, [userId]);

  const closeFamily: CloseFamilyMember[] = relations
    .filter(r => ['child', 'spouse', 'parent'].includes(r.relationship_type))
    .map(r => ({
      ...r.related_user!,  // récupère tout le User (incluant birth_date)
      relationship: r.relationship_type,
      is_guardian: r.is_guardian
    }));

  return { closeFamily, relations };
};
