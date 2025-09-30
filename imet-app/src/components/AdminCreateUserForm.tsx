// src/components/AdminCreateUserForm.tsx

import React, { useState } from "react";
import type { SelectChangeEvent } from "@mui/material";
import {
  Box, Button, Checkbox, FormControl, FormControlLabel,
  InputLabel, MenuItem, Select, Stack, TextField, Typography, Alert
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { userService } from "../services/userService";

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
      const { data, error: svcError } = await userService.createUser({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || undefined,
        birth_date: form.birth_date ? form.birth_date.toISOString() : undefined,
        role: form.role,
        is_active: form.is_active,
      });

      if (svcError) throw new Error(svcError);

      setMessage(`✅ Utilisateur créé : ${data?.full_name ?? form.full_name}`);
      setForm({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        birth_date: null,
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
