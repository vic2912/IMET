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

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [authMode, setAuthMode] = React.useState<'login' | 'signup'>('login');
  const [form, setForm] = React.useState({
    email: '',
    password: ''
  });

  // ✅ État local pour montrer un bandeau "Email envoyé" après inscription
  const [signUpInfo, setSignUpInfo] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      if (authMode === 'signup') {
        setSignUpInfo(null);

        const result = await signUp({
          email: form.email,
          password: form.password
        });

        if (result.success) {
          showSuccess('Compte créé avec succès !');

          // ✅ Info pédagogique : si la confirmation email est activée dans Supabase,
          // un email est envoyé automatiquement. On affiche le message côté UI.
          setSignUpInfo(
            `Un email de confirmation a été envoyé à ${form.email}. Penses à vérifier les spams.`
          );

          // Optionnel : rester sur l’onglet "signup" pour que l’utilisateur lise le message
          // ou basculer sur "login" si tu préfères :
          // setAuthMode('login');
        } else {
          showError(result.error || 'Erreur lors de la création du compte');
        }
      } else {
        const result = await signIn({
          email: form.email,
          password: form.password
        });

        result.success
          ? showSuccess('Connexion réussie !')
          : showError(result.error || 'Erreur lors de la connexion');
      }
    } catch (err: any) {
      showError(err.message || 'Une erreur est survenue');
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
              onClick={handleSubmit}
              startIcon={authMode === 'login' ? <Login /> : <PersonAdd />}
            >
              {authMode === 'login' ? 'Se connecter' : 'Créer un compte'}
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
        </CardContent>
      </Card>
    </Container>
  );
};
