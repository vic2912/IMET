// src/components/admin/CreateUserDialog.tsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  InputAdornment,
  IconButton,
  Box
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { CreateUserData } from '../types/family';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { useSnackbar } from 'notistack';

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserData) => Promise<boolean>;
}

export const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
  open,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<CreateUserData>({
    email: '',
    full_name: '',
    password: '',
    phone: '',
    birth_date: undefined,
    role: 'user',
    is_active: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateUserData, string>>>({});
  const { enqueueSnackbar } = useSnackbar();

  const handleChange = (field: keyof CreateUserData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateUserData, string>> = {};

    if (!formData.email) {
      newErrors.email = 'Email requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.full_name) {
      newErrors.full_name = 'Nom complet requis';
    }

    if (!formData.password) {
      newErrors.password = 'Mot de passe requis';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }

    if (formData.phone && !/^(\+33|0)[1-9](\d{8})$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Numéro de téléphone invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (typeof onSubmit !== 'function') {
      console.error("onSubmit n'est pas une fonction");
      enqueueSnackbar("Erreur interne : onSubmit n'est pas valide", { variant: 'error' });
      return;
    }

    if (!validateForm()) return;

    setLoading(true);
    try {
      const success = await onSubmit(formData);
      if (success) {
        enqueueSnackbar('Utilisateur créé avec succès', { variant: 'success' });
        onClose();
        setFormData({
          email: '',
          full_name: '',
          password: '',
          phone: '',
          birth_date: undefined,
          role: 'user',
          is_active: true
        });
      } else {
        enqueueSnackbar("Une erreur est survenue lors de la création de l'utilisateur", { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar("Erreur inattendue : " + (error as Error).message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            fullWidth
            label="Nom complet"
            value={formData.full_name}
            onChange={(e) => handleChange('full_name', e.target.value)}
            error={!!errors.full_name}
            helperText={errors.full_name}
            required
          />

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={!!errors.email}
            helperText={errors.email}
            required
          />

          <TextField
            fullWidth
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            error={!!errors.password}
            helperText={errors.password}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Téléphone"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            error={!!errors.phone}
            helperText={errors.phone}
            placeholder="+33 6 12 34 56 78"
          />

          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <DatePicker
              label="Date de naissance"
              value={formData.birth_date ? new Date(formData.birth_date) : null}
              onChange={(date) => handleChange('birth_date', date?.toISOString())}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.birth_date,
                  helperText: errors.birth_date
                }
              }}
            />
          </LocalizationProvider>

          <FormControl fullWidth>
            <InputLabel>Rôle</InputLabel>
            <Select
              value={formData.role}
              onChange={(e) => handleChange('role', e.target.value)}
              label="Rôle"
            >
              <MenuItem value="user">Utilisateur</MenuItem>
              <MenuItem value="admin">Administrateur</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active}
                onChange={(e) => handleChange('is_active', e.target.checked)}
              />
            }
            label="Compte actif"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Annuler</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Création...' : 'Créer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
