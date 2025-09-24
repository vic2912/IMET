// src/components/NotificationSettingsDialog.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, Divider, 
  Switch, FormGroup, FormControlLabel, Select, MenuItem, Alert, Box, CircularProgress, Chip } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import EmailIcon from '@mui/icons-material/Email';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import WebAssetIcon from '@mui/icons-material/WebAsset';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { notificationService } from '../services/notificationService';
import type { NotificationSettings, NotificationType } from '../types/notification';

type Props = {
  open: boolean;
  userId: string;
  onClose: () => void;
};

const SUPPORTED_TYPES: NotificationType[] = [
  // Tes nouveaux cas
  'arrival_checklist',
  'departure_checklist',
  'payment_reminder',
  'event_created',
  'event_closed',
];

const TYPE_LABELS: Partial<Record<NotificationType, string>> = {
  arrival_checklist: 'Préparer mon arrivée',
  departure_checklist: 'Préparer mon départ',
  payment_reminder: 'Rappel Paiement',
  event_created: 'Nouveau séjour créé',
  event_closed: 'Nouveau séjour annulé',
  expense_approved: 'Dépense approuvée',
  expense_rejected: 'Dépense rejetée',
  admin_promotion: 'Promotion admin',
  admin_demotion: 'Retrait droits admin',
  pricing_updated: 'Tarifs mis à jour',
  maintenance_scheduled: 'Maintenance planifiée',
  welcome: 'Bienvenue',
};

export const NotificationSettingsDialog: React.FC<Props> = ({ open, userId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<NotificationSettings | null>(null);

  // Charger les préférences à l’ouverture
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!open || !userId) return;
      setLoading(true);
      setError(null);
      const { data, error } = await notificationService.getPreferences(userId);
      if (!mounted) return;
      if (error) setError(error);
      if (data) {
        // S’il manque des clés de types, on complète à false par défaut
        const filled = { ...data };
        filled.preferences = filled.preferences || {};
        for (const t of SUPPORTED_TYPES) {
          if (!filled.preferences[t]) {
            filled.preferences[t] = { email: true, push: true, in_app: true };
          }
        }
        setPrefs(filled as NotificationSettings);
      }
      setLoading(false);
    };
    run();
    return () => { mounted = false; };
  }, [open, userId]);


  // Handlers globals
  const updateGlobal = (key: keyof NotificationSettings, value: any) => {
    if (!prefs) return;
    setPrefs(prev => prev ? { ...prev, [key]: value } as NotificationSettings : prev);
  };

  // Handlers par type
  const updateType = (type: NotificationType, channel: 'email' | 'push' | 'in_app', value: boolean) => {
    if (!prefs) return;
    setPrefs(prev => {
      if (!prev) return prev;
      const next = { ...prev };
      next.preferences = { ...next.preferences };
      next.preferences[type] = next.preferences[type] || { email: true, push: true, in_app: true };
      next.preferences[type][channel] = value;
      return next as NotificationSettings;
    });
  };

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    const { data, error } = await notificationService.updatePreferences(userId, {
      email_enabled: prefs.email_enabled,
      //push_enabled: prefs.push_enabled,
      in_app_enabled: prefs.in_app_enabled,
      email_frequency: prefs.email_frequency,
      preferences: prefs.preferences,
      quiet_hours_start: prefs.quiet_hours_start,
      quiet_hours_end: prefs.quiet_hours_end,
      timezone: prefs.timezone || 'Europe/Paris',
    });
    if (error) setError(error);
    if (data) setPrefs(data);
    setSaving(false);
    if (!error) onClose(); // ferme sur succès
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Paramètres des notifications
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !prefs ? (
          <Alert severity="warning">Aucune préférence chargée.</Alert>
        ) : (
          <Stack spacing={3}>
            {/* Bloc activation push */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <NotificationsActiveIcon />
                <Typography variant="subtitle1" fontWeight={600}>Activation</Typography>
                <Chip size="small" label={prefs.timezone || 'Europe/Paris'} icon={<ScheduleIcon />} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Active les notifications du navigateur et gère tes canaux (email, push, in-app).
              </Typography>

              <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
              </Stack>
            </Box>

            <Divider />

            {/* Canaux globaux */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>Canaux globaux</Typography>
              <FormGroup sx={{ pl: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!prefs.email_enabled}
                      onChange={(e) => updateGlobal('email_enabled', e.target.checked)}
                    />
                  }
                  label={<><EmailIcon fontSize="small" />&nbsp;Email</>}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!prefs.push_enabled}
                      onChange={(e) => updateGlobal('push_enabled', e.target.checked)}
                    />
                  }
                  label={<><SmartphoneIcon fontSize="small" />&nbsp;Push navigateur (bientôt)</>}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!prefs.in_app_enabled}
                      onChange={(e) => updateGlobal('in_app_enabled', e.target.checked)}
                    />
                  }
                  label={<><WebAssetIcon fontSize="small" />&nbsp;Notifications in-app</>}
                />
              </FormGroup>

              <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ minWidth: 140 }}>Fréquence email</Typography>
                <Select
                  size="small"
                  value={prefs.email_frequency || 'immediate'}
                  onChange={(e) => updateGlobal('email_frequency', e.target.value)}
                >
                  <MenuItem value="immediate">Immédiat</MenuItem>
                  <MenuItem value="daily">Quotidien (digest)</MenuItem>
                  <MenuItem value="weekly">Hebdomadaire</MenuItem>
                  <MenuItem value="never">Jamais</MenuItem>
                </Select>
              </Stack>
            </Box>

            <Divider />

            {/* Préférences par type */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>Préférences par type</Typography>
              <Typography variant="caption" color="text.secondary">
                Active les canaux désirés pour chaque type d’événement.
              </Typography>

              <Stack spacing={1.5} sx={{ mt: 1 }}>
                {SUPPORTED_TYPES.map((t) => {
                  const line = prefs.preferences?.[t] || { email: true, push: true, in_app: true };
                  return (
                    <Box key={t} sx={{ p: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                        {TYPE_LABELS[t] || t}
                      </Typography>
                      <Stack direction="row" spacing={2}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={!!line.email}
                              onChange={(e) => updateType(t, 'email', e.target.checked)}
                            />
                          }
                          label="Email"
                        />
                        <FormControlLabel
                          control={<Switch checked={false} disabled />}
                          label="Push"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={!!line.in_app}
                              onChange={(e) => updateType(t, 'in_app', e.target.checked)}
                            />
                          }
                          label="In-app"
                        />
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving || loading} variant="contained">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
