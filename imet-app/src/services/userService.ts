import { supabase, executeQuery } from './supabase';
import type {
  User,
  CreateUserData,
  FamilyRelation,
  CreateFamilyRelationData,
  RelationshipType
} from '../types/family';

const toSupabaseError = (msg: string): { message: string } => ({ message: msg });

export class UserService {
  async createUser(data: CreateUserData): Promise<{ data: User | null; error: string | null }> {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return { data: null, error: 'Utilisateur non authentifié' };

      const payload = {
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone: data.phone || null,
        birth_date: data.birth_date || null,
        role: data.role || 'user',
        is_active: data.is_active ?? true,
        allergies: data.allergies || null
      };

      const response = await fetch('https://dcydlyjmfhzhjtjtjcoo.supabase.co/functions/v1/create_user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await response.json();
      if (!response.ok) {
        return { data: null, error: json.error || "Erreur lors de la création de l'utilisateur." };
      }

      return { data: json.user, error: null };
    } catch (err: any) {
      if (err.message.includes('Failed to fetch')) {
        return {
          data: null,
          error: "Serveur injoignable. Vérifiez votre connexion."
        };
      }
      return { data: null, error: err.message || "Erreur inconnue" };
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<{ data: User | null; error: string | null }> {
    return executeQuery(async () => {
      const payload = {
        email: updates.email,
        full_name: updates.full_name,
        phone: updates.phone || null,
        birth_date: updates.birth_date || null,
        is_active: updates.is_active ?? true,
        is_admin: updates.is_admin ?? false,
        is_student: updates.is_student ?? false,
        allergies: updates.allergies || null
      };

      console.log('📦 payload envoyé :', payload);

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId);

      if (error) {
        console.error('❌ Supabase update error:', error.message);
        return { data: null, error };
      }

      return {
        data: { id: userId, ...payload } as User,
        error: null
      };
    });
  }

  async getUsers(includeInactive = false): Promise<{ data: User[] | null; error: string | null }> {
    return executeQuery(async () => {
      let query = supabase.from('profiles').select('*').order('full_name');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query;
      return { data, error };
    });
  }

  async getUserById(userId: string): Promise<{ data: User | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return { data, error };
    });
  }

  async getUserFamilyRelations(userId: string): Promise<{ data: FamilyRelation[] | null; error: { message: string } | null }> {
    return executeQuery(async () => {
      const { data: directRelations, error: error1 } = await supabase
        .from('family_relations')
        .select(`*, related_user:profiles!related_user_id (*)`)
        .eq('user_id', userId);

      const { data: inverseRelations, error: error2 } = await supabase
        .from('family_relations')
        .select(`*, user:profiles!user_id (*)`)
        .eq('related_user_id', userId);

      if (error1 || error2) {
        console.error('❌ Erreur Supabase :', error1 || error2);
        return {
          data: null,
          error: { message: error1?.message || error2?.message || 'Erreur relations' }
        };
      }

      const validRelations = (directRelations || []).filter(r => r.related_user);

      return { data: validRelations, error: null };
    }) as Promise<{ data: FamilyRelation[] | null; error: { message: string } | null }>;
  }



  async getUserDependents(userId: string): Promise<{ data: User[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data: relations, error } = await supabase
        .from('family_relations')
        .select(`related_user:profiles!related_user_id (*)`)
        .eq('user_id', userId)
        .eq('is_guardian', true);

      type RawRelation = { related_user: User | null };
      const rels = (relations as unknown as RawRelation[]) ?? [];

      const users = rels
        .map(r => r.related_user)
        .filter((u): u is User => !!u);

      return { data: users, error: null };
    });
  }

  async searchUsers(query: string): Promise<{ data: User[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(10);
      return { data, error };
    });
  }

  async addFamilyRelation(data: CreateFamilyRelationData): Promise<{ data: null; error: string | null }> {
    try {
      const inverse = this.getInverseRelationship(data.relationship_type as RelationshipType);
      const directIsGuardian = this.shouldBeGuardian(data.relationship_type as RelationshipType);
      const inverseIsGuardian = this.shouldBeGuardian(inverse);

      const existing = await supabase
        .from('family_relations')
        .select('id')
        .eq('user_id', data.user_id)
        .eq('related_user_id', data.related_user_id)
        .eq('relationship_type', data.relationship_type)
        .maybeSingle();
      if (existing.data) return { data: null, error: "Cette relation existe déjà." };

      const { error } = await supabase
        .from('family_relations')
        .insert({
          user_id: data.user_id,
          related_user_id: data.related_user_id,
          relationship_type: data.relationship_type,
          is_guardian: directIsGuardian
        });

      if (error) return { data: null, error: error.message };

      const inverseExists = await supabase
        .from('family_relations')
        .select('id')
        .eq('user_id', data.related_user_id)
        .eq('related_user_id', data.user_id)
        .eq('relationship_type', inverse)
        .maybeSingle();

      if (!inverseExists.data) {
        await supabase.from('family_relations').insert({
          user_id: data.related_user_id,
          related_user_id: data.user_id,
          relationship_type: inverse,
          is_guardian: inverseIsGuardian
        });
      }

      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  async removeFamilyRelation(relationId: string): Promise<{ error: string | null }> {
    try {
      const { data: relation } = await supabase
        .from('family_relations')
        .select('*')
        .eq('id', relationId)
        .single();

      if (relation) {
        await supabase.from('family_relations').delete().eq('id', relationId);
        await supabase.from('family_relations')
          .delete()
          .eq('user_id', relation.related_user_id)
          .eq('related_user_id', relation.user_id);
      }

      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  private getInverseRelationship(type: RelationshipType): RelationshipType {
    const inverseMap: Record<RelationshipType, RelationshipType> = {
      parent: 'child',
      child: 'parent',
      spouse: 'spouse',
      sibling: 'sibling',
      grandparent: 'grandchild',
      grandchild: 'grandparent',
    };
    return inverseMap[type];
  }

  private shouldBeGuardian(type: RelationshipType): boolean {
    return type === 'parent' || type === 'child';
  }
}

export const userService = new UserService();
