import React, { useState } from 'react';
import {
  Box, Typography, Fab, Tooltip, Stack
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import { useAuth } from '../hooks/useAuth';
import { useBookings } from '../hooks/useBookings';
import { BookingCard } from '../components/BookingCard';
import { BookingWizard } from '../components/BookingWizard';
import { EditBookingDialog } from '../components/EditBookingDialog';
import type { Booking } from '../types/booking';

export const AllBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const { data: bookings = [] } = useBookings(user?.id);
  const [showWizard, setShowWizard] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Tri des séjours dans l’ordre chronologique
  const sortedBookings = [...bookings].sort((a, b) =>
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Liste complète des séjours</Typography>

      <Stack spacing={2}>
        {sortedBookings.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            onEdit={(b) => {
              setBookingToEdit(b);
              setShowEditDialog(true);
            }}
          />
        ))}
      </Stack>

      <Tooltip title="Nouveau séjour">
        <Fab 
          color="primary" 
          sx={{ position: 'fixed', bottom: 32, right: 32 }} 
          onClick={() => {
            setBookingToEdit(null);
            setShowWizard(true);
          }}
        >
          <AddIcon />
        </Fab>
      </Tooltip>

      <BookingWizard
        open={showWizard}
        onClose={() => {
          setShowWizard(false);
          setBookingToEdit(null);
        }}
      />

      {bookingToEdit && showEditDialog && user && (
        <EditBookingDialog
          open={true}
          booking={bookingToEdit}
          onClose={() => {
            setShowEditDialog(false);
            setBookingToEdit(null);
          }}
        />
      )}
    </Box>
  );
};
