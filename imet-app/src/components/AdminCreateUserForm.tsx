// src/components/AdminCreateUserForm.tsx

import React, { useState } from "react";
import type { SelectChangeEvent } from "@mui/material";
import {
  Box, Button, Checkbox, FormControl, FormControlLabel,
  InputLabel, MenuItem, Select, Stack, TextField, Typography, Alert
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { format } from "date-fns";
import { supabase } from "../services/supabase";

type FormState = {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  birth_date: Date | null;       // ← on stocke un Date (ou null)
  role: "user" | "admin";
  is_active: boolean;
};

export default function AdminCreateUserForm() {
  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    birth_date: null,            // ← null au départ
    role: "user",
    is_active: true,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name as keyof FormState]: value as any,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!form.email || !form.password || !form.full_name || !form.birth_date) {
      setError("Tous les champs obligatoires doivent être remplis, y compris la date de naissance.");
      return;
    }

    setLoading(true);

    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", form.email)
        .single();

      if (existing) {
        setError("Un utilisateur avec cet email existe déjà.");
        setLoading(false);
        return;
      }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Utilisateur non authentifié !");

      // On sérialise la date en yyyy-MM-dd pour l'API
      const payload = {
        ...form,
        birth_date: form.birth_date ? format(form.birth_date, "yyyy-MM-dd") : undefined,
      };

      // Ligne développement
      //const response = await fetch("https://dcydlyjmfhzhjtjtjcoo.supabase.co/functions/v1/create_user", {
        // Ligne Production
      const response = await fetch("https://xwxlmrzemlrxtzowznfv.supabase.co/functions/v1/create_user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erreur inconnue");

      setMessage(`✅ Utilisateur créé : ${result.user.full_name}`);
      setForm({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        birth_date: null,  // ← on reset à null
        role: "user",
        is_active: true,
      });
    } catch (error: any) {
      setError(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 500, mx: "auto", mt: 4 }}>
      <Typography variant="h5" gutterBottom>Créer un utilisateur</Typography>

      <Stack spacing={2}>
        <TextField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
          fullWidth
        />

        <TextField
          label="Mot de passe"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
          fullWidth
        />

        <TextField
          label="Nom complet"
          name="full_name"
          value={form.full_name}
          onChange={handleChange}
          required
          fullWidth
        />

        <TextField
          label="Téléphone"
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          fullWidth
        />

        {/* DatePicker avec sélection directe de l'année */}
        <DatePicker
          label="Date de naissance"
          value={form.birth_date}
          onChange={(newValue) => setForm((prev) => ({ ...prev, birth_date: newValue }))}
          disableFuture
          openTo="year"                    // ← ouvre la vue Années en premier
          views={["year", "month", "day"]} // ← navigation Année → Mois → Jour
          slotProps={{
            textField: {
              required: true,
              fullWidth: true,
              InputLabelProps: { shrink: true },
              placeholder: "jj/mm/aaaa",
            },
          }}
        />

        <FormControl fullWidth>
          <InputLabel id="role-label">Rôle</InputLabel>
          <Select
            labelId="role-label"
            name="role"
            value={form.role}
            label="Rôle"
            onChange={handleSelectChange}
          >
            <MenuItem value="user">Utilisateur</MenuItem>
            <MenuItem value="admin">Administrateur</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Checkbox
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
            />
          }
          label="Compte actif"
        />

        <Button type="submit" variant="contained" disabled={loading} fullWidth>
          {loading ? "Création en cours..." : "Créer l'utilisateur"}
        </Button>

        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}
      </Stack>
    </Box>
  );
}
