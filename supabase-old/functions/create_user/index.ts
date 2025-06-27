// Fichier: supabase/functions/create_user/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // GESTION DES REQUÊTES CORS (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Content-Type 'application/json' requis" }), {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Content-Type": "application/json"
        },
      });
    }

    let body;
    try {
      body = await req.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: "Corps JSON invalide ou vide" }), {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Content-Type": "application/json"
        },
      });
    }

    console.log("Payload reçu:", body);

    const {
      email,
      password,
      full_name,
      phone,
      birth_date,
      role = 'user',
      is_active = true
    } = body;

    const is_admin = role === 'admin';

    if (!email || !password || !full_name) {
      return new Response(JSON.stringify({ error: 'Champs requis manquants' }), {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Content-Type": "application/json"
        },
      });
    }

    const supabase = createClient(
      Deno.env.get('PROJECT_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    );
      console.log("identifiants", supabase);
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone
      }
    });

    if (authError || !authUser?.user?.id) {
      console.error("Erreur Auth:", authError);
      return new Response(JSON.stringify({ error: authError?.message || "Erreur Auth inconnue" }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Content-Type": "application/json"
        },
      });
    }

    const userId = authUser.user.id;

    const { data: profile, error: dbError } = await supabase.from('profiles').upsert({
      id: userId,
      email,
      full_name,
      phone,
      birth_date,
      is_admin,
      is_active
    }).select().single();

    if (dbError) {
      console.error("Erreur DB:", dbError);
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Content-Type": "application/json"
        },
      });
    }

    console.log("Utilisateur créé avec succès:", profile);

    return new Response(JSON.stringify({ user: profile }), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json"
      },
    });
  } catch (err) {
    console.error("Erreur serveur:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json"
      },
    });
  }
});
