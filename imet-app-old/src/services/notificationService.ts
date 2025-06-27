// src/services/notificationService.ts

import { supabase, executeQuery } from './supabase';
import {
  Notification,
  CreateNotificationData,
  NotificationPreferences,
  NotificationType,
  NOTIFICATION_TEMPLATES
} from '../types';

export class NotificationService {
  // Créer une notification
  async create(data: CreateNotificationData): Promise<{ data: Notification | null; error: string | null }> {
    try {
      // Récupérer les préférences de l'utilisateur
      const { data: preferences } = await this.getPreferences(data.user_id);

      // Déterminer quels canaux utiliser
      const channels = data.channels || ['in_app', 'push', 'email'];
      const send_in_app = channels.includes('in_app') && preferences?.in_app_enabled !== false;
      const send_push = channels.includes('push') && preferences?.push_enabled !== false;
      const send_email = channels.includes('email') && preferences?.email_enabled !== false;

      // Créer la notification en base
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          ...data,
          send_in_app,
          send_push,
          send_email,
          priority: data.priority || NOTIFICATION_TEMPLATES[data.type]?.priority || 2
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      // Déclencher les envois asynchrones
      if (notification) {
        if (send_push) await this.sendPushNotification(notification);
        if (send_email) await this.sendEmailNotification(notification);
      }

      return { data: notification, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  }

  // Créer une notification depuis un template
  async createFromTemplate(
    userId: string,
    type: NotificationType,
    variables?: Record<string, any>
  ): Promise<{ data: Notification | null; error: string | null }> {
    const template = NOTIFICATION_TEMPLATES[type];
    if (!template) {
      return { data: null, error: 'Template de notification invalide' };
    }

    // Remplacer les variables dans le template
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
      priority: template.priority
    });
  }

  // Récupérer les notifications d'un utilisateur
  async getByUserId(
    userId: string,
    options?: {
      limit?: number;
      unreadOnly?: boolean;
      includeDeleted?: boolean;
    }
  ): Promise<{ data: Notification[] | null; error: string | null }> {
    return executeQuery(async () => {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('send_in_app', true);

      if (!options?.includeDeleted) {
        query = query.eq('is_deleted', false);
      }

      if (options?.unreadOnly) {
        query = query.eq('is_read', false);
      }

      query = query.order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      return { data: data || [], error };
    });
  }

  // Marquer comme lu
  async markAsRead(notificationId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      return { error: error?.message || null };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  // Marquer toutes comme lues
  async markAllAsRead(userId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      return { error: error?.message || null };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  // Supprimer une notification (soft delete)
  async delete(notificationId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_deleted: true })
        .eq('id', notificationId);

      return { error: error?.message || null };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  // Récupérer le nombre de notifications non lues
  async getUnreadCount(userId: string): Promise<{ data: number; error: string | null }> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .eq('is_deleted', false)
        .eq('send_in_app', true);

      return { data: count || 0, error: error?.message || null };
    } catch (error: any) {
      return { data: 0, error: error.message };
    }
  }

  // Préférences de notification
  async getPreferences(userId: string): Promise<{ data: NotificationPreferences | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Si pas de préférences, créer les valeurs par défaut
      if (!data && error?.code === 'PGRST116') {
        const defaultPreferences = {
          user_id: userId,
          email_enabled: true,
          push_enabled: true,
          in_app_enabled: true,
          email_frequency: 'immediate',
          timezone: 'Europe/Paris',
          preferences: {}
        };

        const { data: newData, error: insertError } = await supabase
          .from('user_notification_preferences')
          .insert(defaultPreferences)
          .select()
          .single();

        return { data: newData, error: insertError };
      }

      return { data, error };
    });
  }

  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<{ data: NotificationPreferences | null; error: string | null }> {
    return executeQuery(async () => {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      return { data, error };
    });
  }

  // Méthodes privées pour l'envoi
  private async sendPushNotification(notification: Notification): Promise<void> {
    try {
      // Récupérer les souscriptions push de l'utilisateur
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', notification.user_id)
        .eq('is_active', true);

      if (!subscriptions || subscriptions.length === 0) return;

      // Ici, vous intégreriez avec votre service de push
      // Pour l'instant, on simule juste le succès
      await supabase
        .from('notifications')
        .update({ push_sent_at: new Date().toISOString() })
        .eq('id', notification.id);
    } catch (error: any) {
      await supabase
        .from('notifications')
        .update({ push_error: error.message })
        .eq('id', notification.id);
    }
  }

  private async sendEmailNotification(notification: Notification): Promise<void> {
    try {
      // Ici, vous intégreriez avec votre service d'email (SendGrid, Resend, etc.)
      // Pour l'instant, on simule juste le succès
      await supabase
        .from('notifications')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', notification.id);
    } catch (error: any) {
      await supabase
        .from('notifications')
        .update({ email_error: error.message })
        .eq('id', notification.id);
    }
  }

  // Listener temps réel pour les nouvelles notifications
  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ) {
    return supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.new && payload.new.send_in_app) {
            callback(payload.new as Notification);
          }
        }
      )
      .subscribe();
  }
}

// Utilisation
export const notificationService = new NotificationService();
