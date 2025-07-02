import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack,
} from '@mui/material';


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
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [allergies, setAllergies] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!fullName.trim()) return;

    setLoading(true);
    const success = await onSubmit({
      full_name: fullName,
      birth_date: birthDate || undefined,
      phone: phone || undefined,
      allergies: allergies || undefined,
    });
    setLoading(false);

    if (success) {
      setFullName('');
      setBirthDate('');
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
          />
          <TextField
            label="Date de naissance"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <TextField
            label="Téléphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <TextField
            label="Allergies"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            multiline
            rows={2}
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
