// src/pages/OnboardingPage.tsx
import React, { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Container, Stack, TextField, Typography, Alert } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, parseISO } from 'date-fns';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userId, updateProfile } = useAuth();

    const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    family_name: user?.family_name ?? '',
    phone: user?.phone ?? '',
    allergies: user?.allergies ?? ''
    });

    // État date séparé (Date | null) pour le DatePicker
    const [birthDate, setBirthDate] = useState<Date | null>(
    user?.birth_date ? parseISO(String(user.birth_date)) : null
    );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Si déjà complet, on sort
    const isComplete =
      !!user?.full_name?.trim() &&
      !!user?.family_name?.trim() &&
      !!user?.birth_date &&
      !!user?.profile_completed_at;

    if (isComplete) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const onSave = async () => {
    if (!userId) return;
    if (!form.full_name.trim() || !form.family_name.trim() || !birthDate) {
        setError('Nom complet, nom de famille et date de naissance sont requis.');
        return;
    }
    setSaving(true);
    setError(null);
    const { success, error: updateError } = await updateProfile({
      full_name: form.full_name.trim(),
      family_name: form.family_name.trim(),
      phone: form.phone || null,
      birth_date: birthDate ? format(birthDate, 'yyyy-MM-dd') : null,
      allergies: form.allergies || null,
      profile_completed_at: new Date().toISOString()
    } as any);

    setSaving(false);
    if (!success || updateError) {
      setError(updateError || 'Échec de la mise à jour du profil');
      return;
    }

    // ⚑ Important : on indique au layout que l’on vient de terminer l’onboarding
    localStorage.setItem('imet_onboarding_completed', '1');
    navigate('/dashboard', { replace: true, state: { onboardingJustCompleted: true } });
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>Bienvenue 👋</Typography>
          <Typography color="text.secondary">
            Merci de compléter votre profil pour continuer.
          </Typography>

          <Stack spacing={2} mt={3}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Surnom familial"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Nom de famille"
              value={form.family_name}
              onChange={(e) => setForm({ ...form, family_name: e.target.value })}
              required
              fullWidth
            />

            <TextField
              label="Téléphone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              fullWidth
            />

            <DatePicker
            label="Date de naissance"
            value={birthDate}
            onChange={(newValue) => setBirthDate(newValue)}
            disableFuture
            openTo="year"                    // ← ouvre directement sur les années
            views={['year', 'month', 'day']} // ← navigation année → mois → jour
            slotProps={{
                textField: {
                fullWidth: true,
                required: true,
                InputLabelProps: { shrink: true },
                placeholder: 'aaaa-mm-jj',   // aide visuelle claire
                },
            }}
            />

            <TextField
              label="Allergies"
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              multiline
              minRows={2}
              fullWidth
            />

            <Box display="flex" justifyContent="flex-end" gap={2} mt={1}>
              <Button variant="contained" onClick={onSave} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};
