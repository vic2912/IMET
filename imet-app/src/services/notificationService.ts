// src/services/notificationService.ts

import { supabase, executeQuery } from './supabase';
import type {
  Notification,
  CreateNotificationData,
  NotificationSettings,
  NotificationType
} from '../types/notification';
import { NOTIFICATION_TEMPLATES } from '../types/notification';

/**
 * === ADAPTATION SCHÉMA ===
 * DB tables utilisées maintenant :
 * - notifications (read_at au lieu de is_read)
 * - notification_user_settings (globaux)
 * - notification_preferences (PK user_id, type_id, channel) avec enabled
 * - notification_types (is_active, audience, sort_order)
 *
 * Règle d’envoi in-app :
 *  - on INSÈRE une notif seulement si (in_app_enabled global) && (pref(type,'in_app') = true)
 * Email : on prépare mais on NE l’envoie pas encore (à brancher plus tard).
 */



type Channel = 'in_app' | 'email';

type TypeChannelPrefs = {
  in_app: boolean;
  email: boolean;
};

type EffectivePrefs = {
  globals: {
    in_app_enabled: boolean;
    email_enabled: boolean;
    email_frequency: 'immediate' | 'daily' | 'weekly' | 'never';
    timezone: string;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
  };
  byType: Record<string, TypeChannelPrefs>; // clé = type_id (NotificationType)
};

// --- Utilitaires mapping ---

const ALL_TYPES = Object.keys(NOTIFICATION_TEMPLATES) as NotificationType[];


const toUINotification = (row: any): Notification => {
  // On expose encore is_read côté UI pour compat
  return {
    ...row,
    type: row.type ?? row.type_id, 
    is_read: !!row.read_at,
  } as Notification;
};

const DEFAULT_GLOBALS = {
  in_app_enabled: true,
  email_enabled: true,
  email_frequency: 'immediate' as const,
  timezone: 'Europe/Paris',
  quiet_hours_start: null as string | null,
  quiet_hours_end: null as string | null,
};

const DEFAULT_TYPE_PREF: TypeChannelPrefs = { in_app: true, email: true };

// Les 6 types retenus pour l’UI de départ
const SUPPORTED_TYPES: NotificationType[] = [
  'arrival_checklist',
  'departure_checklist',
  'payment_reminder',
  'event_created',
  'event_closed',
];

export class NotificationService {
  // ===== Préférences =====

  /**
   * Combine settings globaux + préférences par type/canal.
   * S’il manque des lignes, on applique les défauts (true/true par type).
   */
  async getPreferences(userId: string): Promise<{ data: NotificationSettings | null; error: string | null }> {
    try {
      // Globaux
      const { data: globalsRow, error: gErr } = await supabase
        .from('notification_user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (gErr && gErr.code !== 'PGRST116') {
        return { data: null, error: gErr.message };
      }

      const globals = globalsRow
        ? {
            in_app_enabled: !!globalsRow.in_app_enabled,
            email_enabled: !!globalsRow.email_enabled,
            email_frequency: globalsRow.email_frequency || 'immediate',
            timezone: globalsRow.timezone || 'Europe/Paris',
            quiet_hours_start: globalsRow.quiet_hours_start ?? null,
            quiet_hours_end: globalsRow.quiet_hours_end ?? null,
          }
        : { ...DEFAULT_GLOBALS };

      // Préférences par type/canal
      const { data: prefRows, error: pErr } = await supabase
        .from('notification_preferences')
        .select('type_id, channel, enabled')
        .eq('user_id', userId);

      if (pErr) return { data: null, error: pErr.message };

      const byType: EffectivePrefs['byType'] = {};

      for (const t of ALL_TYPES) {
        byType[t] = { ...DEFAULT_TYPE_PREF };
      }

      for (const row of prefRows || []) {
        const t = row.type_id as NotificationType;
        if (!ALL_TYPES.includes(t)) continue; // sécurité
        if (row.channel === 'in_app') byType[t].in_app = !!row.enabled;
        if (row.channel === 'email')  byType[t].email  = !!row.enabled;
      }

      const result: NotificationSettings = {
        user_id: userId,
        email_enabled: globals.email_enabled,
        push_enabled: false, // pas encore activé
        in_app_enabled: globals.in_app_enabled,
        email_frequency: globals.email_frequency,
        timezone: globals.timezone,
        quiet_hours_start: globals.quiet_hours_start || undefined,
        quiet_hours_end: globals.quiet_hours_end || undefined,
        preferences: ALL_TYPES.reduce((acc, type) => {
          const v = byType[type] ?? DEFAULT_TYPE_PREF;
          acc[type] = { email: v.email, push: false, in_app: v.in_app };
          return acc;
        }, {} as Record<NotificationType, { email: boolean; push: boolean; in_app: boolean }>),
      };

      // Si aucune ligne globale en base → créer une par défaut (idempotent)
      if (!globalsRow) {
        await supabase
          .from('notification_user_settings')
          .insert({ user_id: userId, ...DEFAULT_GLOBALS })
          .select()
          .single();
      }

      return { data: result, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  /**
   * Upsert des réglages globaux + upsert des préférences par type/canal.
   * Le Dialog t’envoie un objet combiné qu’on traduit en lignes SQL.
   */
  async updatePreferences(
    userId: string,
    prefs: Partial<NotificationSettings>
  ): Promise<{ data: NotificationSettings | null; error: string | null }> {
    try {
      // 1) Upsert globaux
      const updGlobals = {
        in_app_enabled: prefs.in_app_enabled ?? true,
        email_enabled: prefs.email_enabled ?? true,
        email_frequency: (prefs.email_frequency as any) || 'immediate',
        timezone: prefs.timezone || 'Europe/Paris',
        quiet_hours_start: prefs.quiet_hours_start ?? null,
        quiet_hours_end: prefs.quiet_hours_end ?? null,
        updated_at: new Date().toISOString(),
        user_id: userId,
      };

      const { error: gErr } = await supabase
        .from('notification_user_settings')
        .upsert(updGlobals, { onConflict: 'user_id' });

      if (gErr) return { data: null, error: gErr.message };

      // 2) Upsert par type/canal
      if (prefs.preferences) {
        const rows: { user_id: string; type_id: string; channel: Channel; enabled: boolean }[] = [];
        for (const [typeId, line] of Object.entries(prefs.preferences)) {
          if (!SUPPORTED_TYPES.includes(typeId as NotificationType)) continue;
          // in_app
          if (typeof line.in_app === 'boolean') {
            rows.push({ user_id: userId, type_id: typeId, channel: 'in_app', enabled: line.in_app });
          }
          // email (préparé pour plus tard)
          if (typeof line.email === 'boolean') {
            rows.push({ user_id: userId, type_id: typeId, channel: 'email', enabled: line.email });
          }
        }
        if (rows.length) {
          const { error: pErr } = await supabase
            .from('notification_preferences')
            .upsert(rows, { onConflict: 'user_id,type_id,channel' });
          if (pErr) return { data: null, error: pErr.message };
        }
      }

      // 3) Retour combiné actualisé
      return this.getPreferences(userId);
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ===== Notifications =====

  /**
   * Création d’une notification à partir d’un template.
   * Filtrage par préférences AVANT insertion (in-app).
   */
  async createFromTemplate(
    userId: string,
    type: NotificationType,
    variables?: Record<string, any>
  ): Promise<{ data: Notification | null; error: string | null }> {
    const template = NOTIFICATION_TEMPLATES[type];
    if (!template) return { data: null, error: 'Template de notification invalide' };

    let message = template.message;
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(`{{${key}}}`, String(value));
      });
    }

    return this.create({
      user_id: userId,
      type,
      title: template.title,
      message,
      data: variables,
      priority: template.priority,
    });
  }

  /**
   * Créer une notification (in-app) si autorisée par les préférences.
   * Email : non branché (prévu).
   */
  async create(data: CreateNotificationData): Promise<{ data: Notification | null; error: string | null }> {
    try {
      // Lire préférences
      const { data: prefs, error: pErr } = await this.getPreferences(data.user_id);
      if (pErr || !prefs) return { data: null, error: pErr || 'Préférences introuvables' };

      const typeId = data.type as NotificationType;
      const typePrefs = prefs.preferences?.[typeId as NotificationType];

      const inAppAllowed =
        prefs.in_app_enabled !== false &&
        (!typePrefs || typePrefs.in_app !== false); // défaut = true

      const emailAllowed =
        prefs.email_enabled !== false &&
        (!typePrefs || typePrefs.email !== false);
        
      if (!inAppAllowed) {
        return { data: null, error: null }; // on “ignore” poliment
      }



      // Insérer la notification
      const { data: row, error } = await supabase
        .from('notifications')
        .insert({
          user_id: data.user_id,
          type_id: typeId,
          title: data.title,
          message: data.message,
          data: data.data ?? null,
          send_email: emailAllowed,
        })
        .select()
        .single();

      if (error) return { data: null, error: error.message };

      // Retour UI
      return { data: toUINotification(row), error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // Liste par utilisateur
  async getByUserId(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean; includeDeleted?: boolean }
  ): Promise<{ data: Notification[] | null; error: string | null }> {
    return executeQuery(async () => {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId);

      if (!options?.includeDeleted) query = query.eq('is_deleted', false);
      if (options?.unreadOnly)      query = query.is('read_at', null);

      query = query.order('created_at', { ascending: false });
      if (options?.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      return { data: (data || []).map(toUINotification), error };
    });
  }

  // Compteur non lues
  async getUnreadCount(userId: string): Promise<{ data: number; error: string | null }> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .is('read_at', null);

      return { data: count || 0, error: error?.message || null };
    } catch (e: any) {
      return { data: 0, error: e.message };
    }
  }

  // Marquer comme lu => set read_at
  async markAsRead(notificationId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
      return { error: error?.message || null };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  // Tout marquer comme lu
  async markAllAsRead(userId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
      return { error: error?.message || null };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  // Soft delete
  async delete(notificationId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_deleted: true })
        .eq('id', notificationId);
      return { error: error?.message || null };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  // Temps réel (INSERT only)
  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    return supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new) callback(toUINotification(payload.new));
        }
      )
      .subscribe();
  }
}

export const notificationService = new NotificationService();
