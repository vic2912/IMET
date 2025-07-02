// supabase/functions/create_user/index.ts
// @ts-nocheck

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
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
        headers: corsHeaders(),
      });
    }

    const body = await req.json();
    const {
      email, password, full_name, phone,
      birth_date, role = 'user', is_active = true
    } = body;

    if (!email || !password || !full_name) {
      return new Response(JSON.stringify({ error: 'Champs requis manquants' }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    console.log("URL:", Deno.env.get("SUPABASE_URL"));
    console.log("KEY:", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(0, 10));
    
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone }
    });

    if (authError || !authUser?.user?.id) {
      return new Response(JSON.stringify({ error: authError?.message || "Erreur Auth inconnue" }), {
        status: 500,
        headers: corsHeaders(),
      });
    }

    const userId = authUser.user.id;

    const { data: profile, error: dbError } = await supabase.from('profiles').upsert({
      id: userId, email, full_name, phone, birth_date,
      is_admin: role === 'admin',
      is_active
    }).select().single();

    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: corsHeaders(),
      });
    }

    return new Response(JSON.stringify({ user: profile }), {
      status: 200,
      headers: corsHeaders(),
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  };
}
