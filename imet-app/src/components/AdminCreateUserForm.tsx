// src/components/AdminCreateUserForm.tsx
import React, { useState } from "react";
import { supabase } from "../services/supabase"; // adapte ce chemin selon ton projet

export default function AdminCreateUserForm() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    birth_date: "",
    role: "user",
    is_active: true,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error("Utilisateur non authentifié !");
      }

      //Ligne développement
      //const response = await fetch("https://dcydlyjmfhzhjtjtjcoo.supabase.co/functions/v1/create_user", {

              //Ligne Production
      const response = await fetch("https://xwxlmrzemlrxtzowznfv.supabase.co/functions/v1/create_user", {

        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur inconnue");
      }

      setMessage(`Utilisateur créé avec succès : ${result.user.full_name}`);
      setForm({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        birth_date: "",
        role: "user",
        is_active: true,
      });
    } catch (error: any) {
      setMessage(`Erreur : ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: "auto" }}>
      <h2>Créer un utilisateur</h2>

      <label>Email</label>
      <input type="email" name="email" value={form.email} onChange={handleChange} required />

      <label>Mot de passe</label>
      <input type="password" name="password" value={form.password} onChange={handleChange} required />

      <label>Nom complet</label>
      <input type="text" name="full_name" value={form.full_name} onChange={handleChange} required />

      <label>Téléphone</label>
      <input type="tel" name="phone" value={form.phone} onChange={handleChange} />

      <label>Date de naissance</label>
      <input type="date" name="birth_date" value={form.birth_date} onChange={handleChange} />

      <label>Rôle</label>
      <select name="role" value={form.role} onChange={handleChange}>
        <option value="user">Utilisateur</option>
        <option value="admin">Administrateur</option>
      </select>

      <label>
        <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
        Actif
      </label>

      <button type="submit" disabled={loading}>
        {loading ? "Création en cours..." : "Créer l'utilisateur"}
      </button>

      {message && <p>{message}</p>}
    </form>
  );
}
