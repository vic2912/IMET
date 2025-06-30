import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://dcydlyjmfhzhjtjtjcoo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjeWRseWptZmh6aGp0anRqY29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMjE1ODEsImV4cCI6MjA2NDY5NzU4MX0.2kGRkaRNeb9mOy594oVc-__roIvWUNAVbedBTXEkiKs"
);

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "vicopio@hotmail.com",      // ← remplace ici
    password: "Blabla2025"           // ← et ici
  });

  if (error) {
    console.error("❌ Erreur de login :", error.message);
    return;
  }

  console.log("✅ Ton token JWT :", data.session?.access_token);
}

main();
