// src/services.userService.ts

import { supabase, executeQuery } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

import type { User, CreateUserData, FamilyRelation, CreateFamilyRelationData, RelationshipType, Guest
} from '../types/family';

async function invokeFamilyGraphRebuild(reason?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.functions.invoke('family-graph-rebuild', {
      body: { reason: reason ?? 'app-write' },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    if (error) console.warn('family-graph-rebuild error:', error.message);
  } catch {
    // silencieux
  }
}

export class UserService {
  async createUser(data: CreateUserData): Promise<{ data: User | null; error: string | null }> {
    try {
      // 1) Vérifier l'authentification (on crée un user via une action admin)
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return { data: null, error: 'Utilisateur non authentifié' };

      // 2) Check d’existence SANS 406
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('email', data.email);

      if (countError) return { data: null, error: countError.message };
      if ((count ?? 0) > 0) {
        return { data: null, error: 'Un utilisateur avec cet email existe déjà.' };
      }

      // 3) Normaliser la date → yyyy-MM-dd (Edge Function friendly)
      const birth_date =
        data.birth_date
          ? (typeof data.birth_date === 'string'
              ? data.birth_date.slice(0, 10) // 'YYYY-MM-DD...' -> 'YYYY-MM-DD'
              : format(data.birth_date as Date, 'yyyy-MM-dd'))
          : null;

      // 4) Appel de l’Edge Function via SDK (pas d’URL en dur)
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create_user', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          phone: data.phone || null,
          birth_date,
          role: data.role || 'user',
          is_active: data.is_active ?? true,
          allergies: (data as any).allergies || null,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (fnError) {
        return { data: null, error: fnError.message || "Erreur lors de la création de l'utilisateur." };
      }

      return { data: (fnData as any)?.user ?? null, error: null };
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch')) {
        return { data: null, error: 'Serveur injoignable. Vérifiez votre connexion.' };
      }
      return { data: null, error: err.message || 'Erreur inconnue' };
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
      await invokeFamilyGraphRebuild('updateUser');
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

  async createGuestProfile(data: Omit<Guest, 'id' | 'created_at'>): Promise<{ data: Guest | null; error: string | null }> {
    const guestId = uuidv4();

    const { data: guest, error } = await supabase
      .from('guests')
      .insert([
        {
          id: guestId,
          full_name: data.full_name,
          birth_date: data.birth_date || null,
          phone: data.phone || null,
          allergies: data.allergies || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Erreur création guest :", error);
      return { data: null, error: error.message };
    }
    await invokeFamilyGraphRebuild('createGuestProfile');
    return { data: guest as Guest, error: null };
  }

  async getGuests(): Promise<{ data: Guest[] | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .order('full_name');
      return { data, error };
    });
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
      await invokeFamilyGraphRebuild('addFamilyRelation');
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
        await invokeFamilyGraphRebuild('removeFamilyRelation');
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