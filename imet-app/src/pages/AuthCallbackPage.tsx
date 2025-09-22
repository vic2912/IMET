// src/pages/AuthCallbackPage.tsx
import React, { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Important si detectSessionInUrl=false dans le client
        await supabase.auth.exchangeCodeForSession(window.location.href);

        // Charger le profil (le trigger vient de le créer)
        const retry = async (times = 5, delay = 250) => {
          for (let i = 0; i < times; i++) {
            const { data } = await authService.getCurrentUser();
            if (data) return data;
            await new Promise(r => setTimeout(r, delay));
          }
          return null;
        };

        const profile  = await retry();
        if (cancelled) return;

        const isComplete =
          !!profile?.full_name?.trim() &&
          !!profile?.family_name?.trim() &&
          !!profile?.birth_date &&
          !!profile?.profile_completed_at;

        if (isComplete) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/onboarding', { replace: true });
        }
      } catch (e) {
        navigate('/', { replace: true });
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh" gap={2}>
      <CircularProgress />
      <Typography>Connexion en cours…</Typography>
    </Box>
  );
};
