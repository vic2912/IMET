import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [canReset, setCanReset] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"done"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // 1) Quand la page charge, on vérifie que l’utilisateur est dans une session “recovery”.
  useEffect(() => {
    const checkRecovery = async () => {
      const { data } = await supabase.auth.getSession();
      // data.session?.type n’existe pas ; on utilise plutôt onAuthStateChange ou on teste la présence d’un access_token issu du lien.
      // Supabase place la session avant d’arriver ici si redirectTo pointe bien sur /reset-password.
      // Par sécurité, on considère qu’une session est nécessaire pour updateUser.
      setCanReset(!!data.session);
    };
    checkRecovery();

    // BONUS: écouter les changements d’état (si tu préfères gérer ici l’arrivée de la session)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setCanReset(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Les deux mots de passe ne correspondent pas.");
      return;
    }

    try {
      setStatus("loading");
      const { data, error } = await supabase.auth.updateUser({
        password,
      });
      if (error) throw error;

      setStatus("done");

      // Option : rediriger vers /login après 1–2 secondes
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message ?? "Impossible de mettre à jour le mot de passe.");
    }
  };

  if (!canReset) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Réinitialisation du mot de passe</h1>
        <p>Le lien de réinitialisation est invalide ou expiré. Recommence depuis “Mot de passe oublié”.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Définir un nouveau mot de passe</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Nouveau mot de passe</span>
          <input
            type="password"
            className="mt-1 w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Confirmer le mot de passe</span>
          <input
            type="password"
            className="mt-1 w-full border rounded px-3 py-2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </label>

        {status === "error" && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}
        {status === "done" && (
          <p className="p-3 rounded bg-green-50 border border-green-200">
            Mot de passe mis à jour ! Redirection vers la page de connexion...
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded px-4 py-2 bg-black text-white disabled:opacity-50"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Mise à jour..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
