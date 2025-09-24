/// <reference lib="dom" />
/// <reference lib="deno.ns" />

import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

type NotificationChannel = 'in_app' | 'email';
type NotificationType =
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

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

// Helper date Europe/Paris (J → J+offsetDays) en YYYY-MM-DD
function isoInParis(offsetDays = 0, base = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base);

  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;

  // On manipule une date "pure" en UTC pour éviter les surprises DST
  const utc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  utc.setUTCDate(utc.getUTCDate() + offsetDays);

  const y2 = utc.getUTCFullYear();
  const m2 = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d2 = String(utc.getUTCDate()).padStart(2, '0');
  return `${y2}-${m2}-${d2}`;
}

// Helpers préférences (respecte in_app_enabled + per-type/channel)
async function canSend(userId: string, type: NotificationType, channel: NotificationChannel): Promise<boolean> {
  // Globaux
  const { data: globals } = await supabase
    .from('notification_user_settings')
    .select('in_app_enabled, email_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (channel === 'in_app' && globals && globals.in_app_enabled === false) return false;
  if (channel === 'email'  && globals && globals.email_enabled === false)  return false;

  // Par type/canal (si absent => défaut true)
  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('enabled')
    .eq('user_id', userId)
    .eq('type_id', type)
    .eq('channel', channel)
    .maybeSingle();

  if (pref && pref.enabled === false) return false;
  return true;
}

// Idempotence : une même notif ne doit pas être créée 2x pour le même booking+stage
async function alreadySent(userId: string, type: NotificationType, bookingId: string, stage?: string) {
  let q = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type_id', type)
    .contains("data", { booking_id: bookingId } as Record<string, unknown>);
  if (stage) q = q.contains("data", { stage } as Record<string, unknown>);

  const { count } = await q;
  return (count || 0) > 0;
}

async function insertNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data: Record<string, unknown> | undefined,
  opts: { inApp: boolean; email: boolean }
) {
  // Si aucun canal n'est autorisé, on ne crée rien
  if (!opts.inApp && !opts.email) return;

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type_id: type,
      title,
      message,
      data: data ?? null,
      // Ces colonnes sont "safe" si ajoutées (voir migration ci-dessus)
      send_email: opts.email
      // (optionnel) send_in_app: opts.inApp
    });

  if (error) console.error('insert notif error', error.message);
}

serve(async (_req: Request) => {
  try {
    // 1) Date courante Europe/Paris (sans libs : on prend la date UTC & on décale si besoin)
    const todayISO = isoInParis(0);
    const tomorrowISO = isoInParis(1);

    // 2) ARRIVÉES DEMAIN (J-1) – statuts non annulés, pas encore check-in
    const { data: arrivals, error: arrErr } = await supabase
      .from('bookings')
      .select('id, user_id, start_date, status')
      .neq('status', 'cancelled')
      .eq('start_date', tomorrowISO);

    if (arrErr) throw arrErr;

    for (const b of arrivals || []) {
      const allowed = await canSend(b.user_id, 'arrival_checklist', 'in_app');
      if (!allowed) continue;

      // Dédoublonnage spécifique J-1
      const dup = await alreadySent(b.user_id, 'arrival_checklist', b.id, 'j-1');
      if (dup) continue;

      await insertNotification(
        b.user_id,
        'arrival_checklist',
        'Arrivée demain',
        'Votre arrivée est demain. Ouvrez la checklist d’arrivée.',
        {
          booking_id: b.id,
          stage: 'j-1',
          action: 'open_checklist',
          moment: 'arrival'
        }, 
        { inApp: true, email: false }
      );
    }

    // 3) DÉPARTS DEMAIN (J-1) – statuts non annulés, pas encore check-out
    const { data: departures, error: depErr } = await supabase
      .from('bookings')
      .select('id, user_id, end_date, status')
      .neq('status', 'cancelled')
      .eq('end_date', tomorrowISO);

    if (depErr) throw depErr;

    for (const b of departures || []) {
      const allowed = await canSend(b.user_id, 'departure_checklist', 'in_app');
      if (!allowed) continue;

      // Dédoublonnage spécifique J-1
      const dup = await alreadySent(b.user_id, 'departure_checklist', b.id, 'j-1');
      if (dup) continue;

      await insertNotification(
        b.user_id,
        'departure_checklist',
        'Départ demain',
        'Pensez à la checklist de départ et au règlement du séjour.',
        {
          booking_id: b.id,
          stage: 'j-1',
          action: 'open_checklist',
          moment: 'departure'
        }, 
        { inApp: true, email: false }
      );
    }


    // 4) RAPPEL PAIEMENT — J+7 et J+30 (in-app et/ou email selon prefs)

    /**
     * Règle : séjour terminé (end_date ≤ aujourd’hui Paris), statut ≠ 'paid'
    */

    const { data: toRemind, error: payErr } = await supabase
      .from('bookings')
      .select('id, user_id, end_date, status')
      .eq('status', 'pending')
      .lte('end_date', todayISO);

    if (payErr) throw payErr;

    for (const b of toRemind || []) {
      const daysSinceEnd = Math.floor((Date.parse(todayISO) - Date.parse(b.end_date)) / 86400000);

      // === J+7 ===
      if (daysSinceEnd >= 7) {
        const inAppAllowed  = await canSend(b.user_id, 'payment_reminder', 'in_app');
        const emailAllowed  = await canSend(b.user_id, 'payment_reminder', 'email');
        const dupJ7 = await alreadySent(b.user_id, 'payment_reminder', b.id, 'j7');
        if (!dupJ7 && (inAppAllowed || emailAllowed)) {
          await insertNotification(
            b.user_id,
            'payment_reminder',
            'Rappel de paiement',
            'Votre séjour n’est pas encore réglé. Merci de finaliser le paiement.',
            { booking_id: b.id, stage: 'j7' },
            { inApp: inAppAllowed, email: emailAllowed }
          );
        }
      }

      // === J+30 ===
      if (daysSinceEnd === 30) {
        // Toujours "pending" selon la requête : second rappel si non soldé
        const inAppAllowed  = await canSend(b.user_id, 'payment_reminder', 'in_app');
        const emailAllowed  = await canSend(b.user_id, 'payment_reminder', 'email');
        const dupJ30 = await alreadySent(b.user_id, 'payment_reminder', b.id, 'j30');
        if (!dupJ30 && (inAppAllowed || emailAllowed)) {
          await insertNotification(
            b.user_id,
            'payment_reminder',
            'Rappel de paiement (J+30)',
            'Votre séjour n’est toujours pas réglé. Merci de procéder au paiement.',
            { booking_id: b.id, stage: 'j30' },
            { inApp: inAppAllowed, email: emailAllowed }
          );
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
