// src/pages/AuthPage.tsx
import React from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import { Login, PersonAdd } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<'login' | 'signup'>('login');
  const [form, setForm] = React.useState({
    email: '',
    password: ''
  });

  // ✅ État local pour montrer un bandeau "Email envoyé" après inscription
  const [signUpInfo, setSignUpInfo] = React.useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      setIsSubmitting(true);
      if (authMode === 'signup') {
        setSignUpInfo(null);

        const result = await signUp({
          email: form.email,
          password: form.password
        });

        if (result.success) {
          enqueueSnackbar('Compte créé avec succès !', { variant: 'success' });
          const msg = `Un email de confirmation a été envoyé à ${form.email}. Pense à vérifier les spams.`;
          setSignUpInfo(msg);
          enqueueSnackbar(msg, { variant: 'info' });
        } else {
          enqueueSnackbar(result.error || 'Erreur lors de la création du compte', { variant: 'error' });
        }
      } else {
        const result = await signIn({
          email: form.email,
          password: form.password
        });

       result.success
          ? enqueueSnackbar('Connexion réussie !', { variant: 'success' })
          : enqueueSnackbar(result.error || 'Erreur lors de la connexion', { variant: 'error' });
      }
    } catch (err: any) {
       enqueueSnackbar(err.message || 'Une erreur est survenue', { variant: 'error' });
   } finally {
      setIsSubmitting(false);
     }
   };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom align="center">IMet</Typography>
          <Typography variant="subtitle1" color="textSecondary" align="center">
            Gestion de votre maison familiale
          </Typography>
          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Stack spacing={3} mt={3}>
              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                fullWidth
                required
              />

              <Box>
                <TextField
                  label="Mot de passe"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  fullWidth
                  required
                />
                {/* ✅ Lien 'Mot de passe oublié ?' seulement en mode login */}
                {authMode === 'login' && (
                  <Box sx={{ mt: 1, textAlign: 'right' }}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => navigate('/forgot-password')}
                    >
                      Mot de passe oublié ?
                    </Button>
                  </Box>
                )}
              </Box>

              <Button
                variant="contained"
                size="large"
                type="submit"
                disabled={!form.email || !form.password || isSubmitting}
                startIcon={authMode === 'login' ? <Login /> : <PersonAdd />}
              >
              {isSubmitting
                ? (authMode === 'login' ? 'Connexion…' : 'Création…')
                : (authMode === 'login' ? 'Se connecter' : 'Créer un compte')}
              </Button>

              <Button
                variant="text"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setSignUpInfo(null);
                }}
              >
                {authMode === 'login'
                  ? 'Pas encore de compte ? Créer un compte'
                  : 'Déjà un compte ? Se connecter'}
              </Button>

              {/* ✅ Bandeau d’information après sign up */}
              {authMode === 'signup' && signUpInfo && (
                <Alert severity="info">{signUpInfo}</Alert>
              )}
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};
