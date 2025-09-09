// src/components/CreateGuestDialog.tsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    full_name: string;
    birth_date?: string;
    phone?: string;
    allergies?: string;
  }) => Promise<boolean>;
}

export const CreateGuestDialog: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [phone, setPhone] = useState('');
  const [allergies, setAllergies] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!fullName.trim()) return;

    setLoading(true);
    const success = await onSubmit({
      full_name: fullName,
      birth_date: birthDate ? format(birthDate, 'yyyy-MM-dd') : undefined, // ← ISO (yyyy-MM-dd) pour la base
      phone: phone || undefined,
      allergies: allergies || undefined,
    });
    setLoading(false);

    if (success) {
      setFullName('');
      setBirthDate(null);
      setPhone('');
      setAllergies('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Créer un participant invité</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Nom complet *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            fullWidth
          />

          {/* Sélecteur de date avec choix direct de l’année */}
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
                InputLabelProps: { shrink: true },
                placeholder: 'jj/mm/aaaa',
              },
            }}
          />

          <TextField
            label="Téléphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
          />
          <TextField
            label="Allergies"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Annuler</Button>
        <Button onClick={handleSubmit} disabled={loading || !fullName} variant="contained">
          Créer
        </Button>
      </DialogActions>
    </Dialog>
  );
};
