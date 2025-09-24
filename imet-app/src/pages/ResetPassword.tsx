import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Alert,
  LinearProgress,
  Stack
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  CheckCircleOutline,
  ErrorOutline
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [canReset, setCanReset] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // 1) Vérifier qu'on est bien dans une session "recovery" Supabase
  useEffect(() => {
    let active = true;

    const checkRecovery = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setCanReset(!!data.session);
    };
    checkRecovery();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) setCanReset(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // 2) Règles de sécurité & force du mot de passe (live)
  const rules = useMemo(() => {
    const lengthOk = password.length >= 8;          // règle minimale
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpec  = /[^A-Za-z0-9]/.test(password);
    return { lengthOk, hasLower, hasUpper, hasDigit, hasSpec };
  }, [password]);

  const strength = useMemo(() => {
    let score = 0;
    if (rules.lengthOk) score += 25;
    if (rules.hasLower && rules.hasUpper) score += 25;
    if (rules.hasDigit) score += 25;
    if (rules.hasSpec) score += 25;
    return score; // 0..100
  }, [rules]);

  const match = password.length > 0 && password === confirm;
  const hasErrors = !rules.lengthOk || !match;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!rules.lengthOk) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!match) {
      setErrorMsg('Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      setStatus('loading');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setStatus('done');
      enqueueSnackbar('Mot de passe mis à jour !', { variant: 'success' });

      // Redirection douce (tu peux changer pour "/login" si tu préfères)
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message ?? 'Impossible de mettre à jour le mot de passe.');
    }
  };

  if (!canReset) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom>
              Réinitialisation du mot de passe
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Le lien de réinitialisation est invalide ou expiré. Recommence depuis « Mot de passe oublié ».
            </Typography>
            <Button fullWidth variant="contained" onClick={() => navigate('/forgot-password')}>
              Revenir à “Mot de passe oublié”
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 8 } }}>
      <Card elevation={2}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h5" align="center" gutterBottom>
            Définir un nouveau mot de passe
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Pour votre sécurité, choisissez un mot de passe robuste.
          </Typography>

          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                label="Nouveau mot de passe"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoComplete="new-password"
                inputProps={{ minLength: 8 }}
                autoFocus
                placeholder="Au moins 8 caractères"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        onClick={() => setShowPwd((s) => !s)}
                        edge="end"
                      >
                        {showPwd ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                helperText="Utilisez des lettres majuscules/minuscules, chiffres et caractères spéciaux."
              />

              {/* Force du mot de passe */}
              <Box>
                <LinearProgress variant="determinate" value={strength} />
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                  <RuleItem ok={rules.lengthOk} label="≥ 8 caractères" />
                  <RuleItem ok={rules.hasLower && rules.hasUpper} label="Majuscules & minuscules" />
                  <RuleItem ok={rules.hasDigit} label="Chiffre" />
                  <RuleItem ok={rules.hasSpec} label="Caractère spécial" />
                </Stack>
              </Box>

              <TextField
                label="Confirmer le mot de passe"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                fullWidth
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showConfirm ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                        onClick={() => setShowConfirm((s) => !s)}
                        edge="end"
                      >
                        {showConfirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                helperText={
                  confirm.length > 0
                    ? (match ? 'Les mots de passe correspondent.' : 'Les deux mots de passe doivent correspondre.')
                    : 'Retapez le même mot de passe.'
                }
                error={confirm.length > 0 && !match}
              />

              {status === 'error' && (
                <Alert severity="error" variant="outlined">
                  {errorMsg}
                </Alert>
              )}
              {status === 'done' && (
                <Alert severity="success" variant="outlined">
                  Mot de passe mis à jour ! Redirection…
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={status === 'loading' || hasErrors}
              >
                {status === 'loading' ? 'Mise à jour…' : 'Enregistrer'}
              </Button>

              <Button
                variant="text"
                fullWidth
                onClick={() => navigate('/login')}
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

/** Affiche une petite règle (ok/ko) pour le mot de passe */
function RuleItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      {ok ? (
        <CheckCircleOutline fontSize="small" />
      ) : (
        <ErrorOutline fontSize="small" />
      )}
      <Typography variant="caption" color={ok ? 'text.primary' : 'text.secondary'}>
        {label}
      </Typography>
    </Stack>
  );
}
