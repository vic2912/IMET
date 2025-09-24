/// <reference lib="dom" />
/// <reference lib="deno.ns" />

import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

/**
 * Secrets requis (à définir dans Supabase → Edge Functions → Secrets) :
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - RESEND_API_KEY
 * Recommandés :
 * - FROM_EMAIL        (ex: "IMet <notifications@votre-domaine.fr>")
 * - APP_BASE_URL      (ex: "https://app.imet.fr")
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "IMet <onboarding@resend.dev>";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://app.example.com";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type BookingRow = {
  id: string;
  start_date: string;
  end_date: string;
  adults: number | null;
  children: number | null;
  total_cost: number | string | null;
};

/* ------------------------------ Helpers ---------------------------------- */

async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend ${resp.status}: ${body}`);
  }
}

const fmtDateFR = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtDateTimeFR = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR");

const fmtMoneyEUR = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v || 0);
};

const personsCount = (adults?: number | null, children?: number | null) => (adults ?? 0) + (children ?? 0);

/* ------------------------------- Handler ---------------------------------- */

serve(async (_req) => {
  // 1) Charger les notifications à envoyer (digest par utilisateur)
  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id, user_id, title, message, data, created_at")
    .eq("send_email", true)
    .is("email_sent_at", null)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Select notifications error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
  if (!pending?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  // 2) Grouper par utilisateur
  const byUser = new Map<string, typeof pending>();
  for (const n of pending) {
    if (!byUser.has(n.user_id)) byUser.set(n.user_id, []);
    byUser.get(n.user_id)!.push(n);
  }
  const userIds = Array.from(byUser.keys());

  // 3) Résoudre les emails des utilisateurs
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);
  if (pErr) {
    console.error("Select profiles error:", pErr);
    return new Response(JSON.stringify({ ok: false, error: pErr.message }), { status: 500 });
  }

  // 4) Charger en batch les bookings référencés dans data.booking_id
  const bookingIds = Array.from(
    new Set(
      pending
        .map((n) => n?.data?.booking_id)
        .filter((x): x is string => typeof x === "string" && x.length > 0)
    )
  );

  const bookingById = new Map<string, BookingRow>();
  if (bookingIds.length > 0) {
    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("id, start_date, end_date, adults, children, total_cost")
      .in("id", bookingIds);
    if (bErr) {
      console.error("Select bookings error:", bErr);
      // On continue sans enrichissement si erreur
    } else if (bookings) {
      for (const b of bookings) bookingById.set(b.id, b);
    }
  }

  // 5) Construire & envoyer les emails
  let sentCount = 0;

  for (const userId of userIds) {
    const user = profiles?.find(p => p.id === userId);
    if (!user?.email) {
      console.warn("No email for user", userId, "- skipping");
      continue;
    }

    const list = byUser.get(userId)!;

    // Sujet : si plusieurs notifs, on met un sujet global
    const subject = (list.length === 1)
      ? (list[0].title ?? "Notification IMet")
      : `Vous avez ${list.length} notifications IMet`;

    // Corps HTML : chaque élément enrichi si booking trouvé
    const itemsHTML = list.map((n) => {
      const b = n?.data?.booking_id ? bookingById.get(n.data.booking_id) : null;
      const bookingLine = b
        ? `<div style="font-size:14px; color:#444; margin-top:4px;">
             Séjour&nbsp;: ${fmtDateFR(b.start_date)} → ${fmtDateFR(b.end_date)}
             &nbsp;•&nbsp; ${personsCount(b.adults, b.children)} personne(s)
             &nbsp;•&nbsp; Montant&nbsp;: ${fmtMoneyEUR(b.total_cost)}
           </div>`
        : "";

      return `
        <li style="margin-bottom:12px;">
          <div><b>${n.title ?? "Notification"}</b></div>
          ${n.message ? `<div>${n.message}</div>` : ""}
          ${bookingLine}
          <div style="font-size:12px; color:#888;">Reçue le ${fmtDateTimeFR(n.created_at)}</div>
        </li>`;
    }).join("");

    const html = `
      <div>
        <p>Bonjour ${user.full_name ?? ""},</p>
        <p>Voici vos dernières notifications IMet :</p>
        <ul style="padding-left:18px; margin:0;">${itemsHTML}</ul>
        <p style="margin-top:16px;">
          <a href="${APP_BASE_URL}">Ouvrir l’application IMet</a>
        </p>
      </div>
    `;

    // Corps texte (fallback)
    const itemsText = list.map((n) => {
      const b = n?.data?.booking_id ? bookingById.get(n.data.booking_id) : null;
      const bookingLine = b
        ? `  - Séjour: ${fmtDateFR(b.start_date)} -> ${fmtDateFR(b.end_date)} | `
          + `${personsCount(b.adults, b.children)} pers. | Montant: ${fmtMoneyEUR(b.total_cost)}`
        : null;

      return [
        `• ${n.title ?? "Notification"}${n.message ? ` — ${n.message}` : ""}`,
        bookingLine
      ].filter(Boolean).join("\n");
    }).join("\n");

    const text = `Bonjour ${user.full_name ?? ""},

Voici vos dernières notifications IMet :
${itemsText}

Ouvrir l’application : ${APP_BASE_URL}
`;

    try {
      await sendEmail(user.email, subject, html, text);
      const ids = list.map(n => n.id);
      await supabase
        .from("notifications")
        .update({ email_sent_at: new Date().toISOString() })
        .in("id", ids);
      sentCount += ids.length;
    } catch (e) {
      const ids = list.map(n => n.id);
      await supabase
        .from("notifications")
        .update({ email_error: String(e) })
        .in("id", ids);
      console.error("Email send error for user", userId, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: sentCount }), { status: 200 });
});
