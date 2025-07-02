import React, { useState } from "react";
import type { SelectChangeEvent } from "@mui/material";
import {
  Box, Button, Checkbox, FormControl, FormControlLabel,
  InputLabel, MenuItem, Select, Stack, TextField, Typography, Alert
} from "@mui/material";
import { supabase } from "../services/supabase";

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
      [name]: value,
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

      if (!token) {
        throw new Error("Utilisateur non authentifié !");
      }
      //Ligne développement
      const response = await fetch("https://dcydlyjmfhzhjtjtjcoo.supabase.co/functions/v1/create_user", {

      //Ligne Production
      //const response = await fetch("https://xwxlmrzemlrxtzowznfv.supabase.co/functions/v1/create_user", {

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

      setMessage(`✅ Utilisateur créé : ${result.user.full_name}`);
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

        <TextField
          label="Date de naissance"
          name="birth_date"
          type="date"
          value={form.birth_date}
          onChange={handleChange}
          InputLabelProps={{ shrink: true }}
          required
          fullWidth
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
