// src/pages/DashboardPage.tsx

import React, { useState } from 'react';
import { Box, Button, Typography, Divider, Stack } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useBookings } from '../hooks/useBookings';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { BookingWizard } from '../components/BookingWizard';
import { BookingCard } from '../components/BookingCard';

import { differenceInCalendarDays, isAfter, isBefore, isWithinInterval } from 'date-fns';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { data: bookings = [], isLoading, error } = useBookings(user?.id);
  const createBooking = useCreateBooking();

  const [showWizard, setShowWizard] = useState(false);

  const today = new Date();

  const currentBooking = bookings.find(b =>
    isWithinInterval(today, {
      start: new Date(b.start_date),
      end: new Date(b.end_date)
    })
  );

  const unpaidBookings = bookings.filter(b => b.status !== 'payé' && isBefore(new Date(b.end_date), today));
  const futureBookings = bookings.filter(b => isAfter(new Date(b.start_date), today));

  const total = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const paid = bookings.reduce((sum, b) => sum + (b.status === 'payé' ? (b.total_amount || 0) : 0), 0);
  const due = total - paid;

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Tableau de bord</Typography>

      {currentBooking && (
        <Box mb={3}>
          <Typography variant="h6"> 🗓 👥 💰 Séjour en cours</Typography>
          <BookingCard booking={currentBooking} />
        </Box>
      )}

      {unpaidBookings.length > 0 && (
        <Box mb={3}>
          <Typography variant="h6">Séjours à régler</Typography>
          <Stack spacing={2}>{unpaidBookings.map(b => <BookingCard key={b.id} booking={b} />)}</Stack>
        </Box>
      )}

      {futureBookings.length > 0 && (
        <Box mb={3}>
          <Typography variant="h6">Séjours à venir</Typography>
          <Stack spacing={2}>{futureBookings.map(b => <BookingCard key={b.id} booking={b} />)}</Stack>
        </Box>
      )}

      <Box textAlign="center" my={3}>
        <Button variant="contained" onClick={() => setShowWizard(true)}>+ Nouveau séjour</Button>
      </Box>

      <Divider />

      <Box mt={3}>
        <Typography>Total payé : {paid} €</Typography>
        <Typography>Total à payer : {due} €</Typography>
        <Typography>Total global : {total} €</Typography>
      </Box>

      <BookingWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
      />
    </Box>
  );
};
