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

export const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [authMode, setAuthMode] = React.useState<'login' | 'signup'>('login');
  const [form, setForm] = React.useState({
    email: '',
    password: '',
    fullName: '',
    familyName: ''
  });

  const handleSubmit = async () => {
    try {
      if (authMode === 'signup') {
        if (!form.fullName.trim()) {
          showError('Le nom complet est requis');
          return;
        }

        const result = await signUp({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          familyName: form.familyName
        });

        result.success
          ? showSuccess('Compte créé avec succès !')
          : showError(result.error || 'Erreur lors de la création du compte');
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
            <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth required />
            <TextField label="Mot de passe" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} fullWidth required />
            {authMode === 'signup' && (
              <>
                <TextField label="Nom complet" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} fullWidth required />
                <TextField label="Nom de famille" value={form.familyName} onChange={(e) => setForm({ ...form, familyName: e.target.value })} fullWidth />
              </>
            )}
            <Button variant="contained" size="large" onClick={handleSubmit} startIcon={authMode === 'login' ? <Login /> : <PersonAdd />}>
              {authMode === 'login' ? 'Se connecter' : 'Créer un compte'}
            </Button>
            <Button variant="text" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
              {authMode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};