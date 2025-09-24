// src/types/notification.ts

export type NotificationType = 
  | 'arrival_checklist'
  | 'departure_checklist'
  | 'payment_reminder'
  | 'event_created'
  | 'event_closed'
  | 'booking_created_for_you'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'booking_payment_due'
  | 'expense_approved'
  | 'expense_rejected'
  | 'admin_promotion'
  | 'admin_demotion'
  | 'pricing_updated'
  | 'maintenance_scheduled'
  | 'welcome';

export type NotificationChannel = 'in_app' | 'push' | 'email';
// Action front déclenchée au clic sur la notif
export type NotificationAction =
  | 'open_checklist'
  | 'open_payment'
  | 'open_booking'
  | 'open_notice'
  | string; // extensible

export type ChecklistMoment = 'arrival' | 'departure';

// Métadonnées transportées dans la notif (JSONB en base)
export interface NotificationData {
  /** Intention d’action côté front (navigation) */
  action?: NotificationAction;

  /** Lien direct (absolu ou relatif) — compat éventuelle avec anciennes notifs */
  action_url?: string;

  /** Contexte pour open_checklist */
  moment?: ChecklistMoment;

  /** Contexte serveur/analytique + dédoublonnage */
  booking_id?: string;

  /** Étape d’envoi (ex: J-1, J, J+7, J+30) */
  stage?: 'j-1' | 'j' | 'j7' | 'j30';

  /** Label CTA éventuel (UI) */
  cta_label?: string;

  /** Pour rester extensible sans retoucher les types */
  [k: string]: unknown;
}


export type EmailFrequency = 'immediate' | 'daily' | 'weekly' | 'never';
export type NotificationPriority = 1 | 2 | 3 | 4 | 5;

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  
  // États
  is_read: boolean;
  is_deleted: boolean;
  
  // Canaux
  send_email: boolean;
  send_push: boolean;
  send_in_app: boolean;
  
  // Statuts de livraison
  email_sent_at?: string;
  push_sent_at?: string;
  email_error?: string;
  push_error?: string;
  
  // Métadonnées
  priority: NotificationPriority;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationData {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  priority?: NotificationPriority;
  expires_at?: string;
  channels?: NotificationChannel[];
}

// AReprendre - Faut-il garder par la suite cette partie qui est remplacée par NotificationSetting (Sept2025)
export interface NotificationPreferences {
  id: string;
  user_id: string;
  
  // Canaux globaux
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  
  // Fréquence email
  email_frequency: EmailFrequency;
  
  // Préférences par type
  preferences: Record<NotificationType, {
    email: boolean;
    push: boolean;
    in_app: boolean;
  }>;
  
  // Heures de silence
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone: string;
  
  created_at: string;
  updated_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent?: string;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
}

// Templates de notifications
export const NOTIFICATION_TEMPLATES: Record<NotificationType, {
  title: string;
  message: string;
  priority: NotificationPriority;
}> = {
  booking_created_for_you: {
    title: 'Nouvelle réservation',
    message: 'Une réservation a été créée pour vous du {{start_date}} au {{end_date}}',
    priority: 3
  },
  booking_confirmed: {
    title: 'Réservation confirmée',
    message: 'Votre réservation du {{start_date}} au {{end_date}} est confirmée',
    priority: 2
  },
  booking_cancelled: {
    title: 'Réservation annulée',
    message: 'Votre réservation du {{start_date}} a été annulée',
    priority: 3
  },
  booking_reminder: {
    title: 'Rappel de séjour',
    message: 'Votre séjour commence {{when}}',
    priority: 2
  },
  booking_payment_due: {
    title: 'Paiement requis',
    message: 'Un paiement de {{amount}}€ est requis pour votre réservation',
    priority: 4
  },
  expense_approved: {
    title: 'Dépense approuvée',
    message: 'Votre dépense de {{amount}}€ a été approuvée',
    priority: 2
  },
  expense_rejected: {
    title: 'Dépense rejetée',
    message: 'Votre dépense de {{amount}}€ a été rejetée',
    priority: 3
  },
  admin_promotion: {
    title: 'Droits administrateur',
    message: 'Vous avez été promu administrateur',
    priority: 3
  },
  admin_demotion: {
    title: 'Droits modifiés',
    message: 'Vos droits administrateur ont été retirés',
    priority: 3
  },
  pricing_updated: {
    title: 'Tarifs mis à jour',
    message: 'Les tarifs de la maison ont été modifiés',
    priority: 1
  },
  maintenance_scheduled: {
    title: 'Maintenance prévue',
    message: 'Une maintenance est prévue le {{date}}',
    priority: 2
  },
  welcome: {
    title: 'Bienvenue sur IMet !',
    message: 'Votre compte a été créé avec succès',
    priority: 2
  },
  arrival_checklist: {
    title: 'Bienvenue !',
    message: 'Votre arrivée est aujourd’hui. Ouvrez la checklist d’arrivée.',
    priority: 3
  },
  departure_checklist: {
    title: 'Départ aujourd’hui',
    message: 'Pensez à la checklist de départ et au règlement du séjour.',
    priority: 3
  },
  payment_reminder: {
    title: 'Rappel de paiement',
    message: 'Votre séjour n’est pas encore réglé. Merci de finaliser le paiement.',
    priority: 4
  },

  event_created: {
    title: 'Nouvel événement',
    message: 'Un nouvel événement a été déclaré : {{event_title}}',
    priority: 2
  },
  event_closed: {
    title: 'Événement clôturé',
    message: 'L’événement est clôturé : {{event_title}}',
    priority: 2
  }
};


// Type combiné utilisé par l'UI (pas d'id/created_at/updated_at requis)
export interface NotificationSettings {
  user_id: string; // pratique à renvoyer
  // Canaux globaux
  email_enabled: boolean;
  push_enabled: boolean; // on le garde pour l’UI même s’il est inactif
  in_app_enabled: boolean;

  // Fréquence email
  email_frequency: EmailFrequency;

  // Heures de silence
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone: string;

  // Préférences par type
  preferences: Record<NotificationType, {
    email: boolean;
    push: boolean;
    in_app: boolean;
  }>;
}
