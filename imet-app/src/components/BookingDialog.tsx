import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Chip
} from '@mui/material';
import { getStatusLabel } from '../utils/bookingUtils';
import { getChipColor } from '../utils/bookingUtils';
import type { Booking, SejourStatus } from '../types/booking';

interface BookingDialogProps {
  open: boolean;
  booking: Booking;
  onClose: () => void;
  onEdit: (booking: Booking) => void;
  onUpdateStatus: (status: SejourStatus) => void;
}

export const BookingDialog: React.FC<BookingDialogProps> = ({ open, booking, onClose, onEdit, onUpdateStatus }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<SejourStatus | null>(null);

  const handleStatusChange = (newStatus: SejourStatus) => {
    setTargetStatus(newStatus);
    setConfirmOpen(true);
  };

  const confirmStatusChange = () => {
    if (!targetStatus) return;
    onUpdateStatus(targetStatus);
    setConfirmOpen(false);
  };

  const isPaid = booking.status === 'paid';
  const isCancelled = booking.status === 'cancelled';

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Détails du séjour</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body1">
              Du {booking.start_date} au {booking.end_date}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body1">Statut actuel :</Typography>
              <Chip label={getStatusLabel(booking.status)} color={getChipColor(booking.status)} size="small" />
            </Stack>

            <Typography variant="body1">
              Nombre de participants : {booking.adults} adultes et {booking.children} enfants
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleStatusChange('paid')}
            color="success"
            variant="outlined"
            disabled={isPaid || isCancelled}
          >
            Marquer comme payé
          </Button>
          <Button
            onClick={() => handleStatusChange('cancelled')}
            color="error"
            variant="outlined"
            disabled={isPaid || isCancelled}
          >
            Annuler le séjour
          </Button>
          <Button onClick={() => onEdit(booking)} variant="outlined">
            Modifier le séjour
          </Button>
          <Button onClick={onClose}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirmer la modification</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir changer le statut en "{targetStatus ? getStatusLabel(targetStatus) : ''}" ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Annuler</Button>
          <Button onClick={confirmStatusChange} variant="contained" color="primary">
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
