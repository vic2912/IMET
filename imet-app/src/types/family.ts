// src/types/family.ts

export interface FamilyRelation {
  id: string;
  user_id: string;          // L'utilisateur qui a la relation
  related_user_id: string;  // L'utilisateur lié
  relationship_type: RelationshipType;
  is_guardian: boolean;     // Peut créer des réservations pour cette personne
  created_at: string;
  updated_at: string;
  
  // Relations
  user?: User;
  related_user?: User;
}

export type RelationshipType = 
  | 'parent'      // Parent de
  | 'child'       // Enfant de
  | 'spouse'      // Conjoint de
  | 'sibling'     // Frère/Sœur de
  | 'grandparent' // Grand-parent de
  | 'grandchild'  // Petit-enfant de

export type CreateFamilyRelationData = {
  user_id: string; // 👈 celui qu’on relie
  related_user_id: string;
  relationship_type: string;
  is_guardian?: boolean;
};

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  birth_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_admin?: boolean;
  allergies?: string;
  is_student?: boolean;
  // Relations familiales
  family_relations?: FamilyRelation[];
  related_to?: FamilyRelation[];
}

export interface CreateUserData {
  email: string;
  full_name: string;
  password: string;
  phone?: string;
  birth_date?: string;
  role?: 'admin' | 'user';
  is_active?: boolean;
  allergies?: string;
}

