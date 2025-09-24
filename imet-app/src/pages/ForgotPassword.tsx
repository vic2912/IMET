import React, { useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  Stack,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Email, Send, ArrowBack, Clear } from '@mui/icons-material';
import { useSnackbar } from 'notistack';

type Status = 'idle' | 'loading' | 'sent' | 'error';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Validation simple d’email (suffisant pour l’UI)
  const isValidEmail = useMemo(() => {
    if (!email) return false;
    // Regex simple, évite les faux positifs les plus courants
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) throw error;

      setStatus('sent');

      // Toast info global (cohérent avec le reste de l’app)
      enqueueSnackbar(
        `Si un compte existe pour ${email.trim()}, un email de réinitialisation a été envoyé.`,
        { variant: 'info' }
      );
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Une erreur est survenue.');
      setStatus('error');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 8 } }}>
      <Card elevation={2}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h5" align="center" gutterBottom>
            Mot de passe oublié
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Saisis ton adresse email. Si un compte existe, tu recevras un lien de réinitialisation.
          </Typography>

          {status === 'sent' ? (
            <Alert severity="success" variant="outlined" sx={{ mb: 2 }}>
              Si un compte existe pour <strong>{email}</strong>, un email de réinitialisation vient d’être envoyé.
              Pense à vérifier tes spams.
            </Alert>
          ) : null}

          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoComplete="email"
                placeholder="ton.email@exemple.com"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email />
                    </InputAdornment>
                  ),
                  endAdornment: email ? (
                    <InputAdornment position="end">
                      <IconButton aria-label="Effacer" onClick={() => setEmail('')} edge="end">
                        <Clear />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined
                }}
                error={email.length > 0 && !isValidEmail}
                helperText={
                  email.length > 0 && !isValidEmail
                    ? 'Adresse email invalide'
                    : 'Nous enverrons le lien si un compte existe.'
                }
              />

              {status === 'error' && (
                <Alert severity="error" variant="outlined">
                  {errorMsg}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<Send />}
                fullWidth
                disabled={status === 'loading' || !isValidEmail}
              >
                {status === 'loading' ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
              </Button>

              <Button
                variant="text"
                startIcon={<ArrowBack />}
                fullWidth
                onClick={() => navigate('/')}
              >
                Revenir à la connexion
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
