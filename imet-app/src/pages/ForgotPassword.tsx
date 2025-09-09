import { useState } from "react";
import { supabase } from "../services/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"sent"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      // IMPORTANT: mets ici l’URL de ta page ResetPassword (voir plus bas section routes).
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      setStatus("sent");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Une erreur est survenue.");
      setStatus("error");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Mot de passe oublié</h1>
      {status === "sent" ? (
        <p className="p-3 rounded bg-green-50 border border-green-200">
          Si un compte existe pour <strong>{email}</strong>, un email de réinitialisation vient d’être envoyé.
          Pense à vérifier tes spams.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="ton.email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          {status === "error" && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}

          <button
            type="submit"
            className="w-full rounded px-4 py-2 bg-black text-white disabled:opacity-50"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Envoi..." : "Envoyer le lien de réinitialisation"}
          </button>
        </form>
      )}
    </div>
  );
}
