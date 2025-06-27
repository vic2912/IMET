import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Card, CardContent, Stack, Typography, Chip } from '@mui/material';
import { Event, People, MonetizationOn } from '@mui/icons-material';
import { parseISO, format } from 'date-fns';
import { BookingDialog } from './BookingDialog';
import { getStatusLabel, getChipColor } from '../utils/bookingUtils';
import { useUpdateBookingStatus } from '../hooks/useUpdateBookingStatus';
import { useSnackbar } from 'notistack';
import { useAuth } from '../hooks/useAuth';
import type { Booking } from '../types/booking';

interface PersonDetails {
  id: string;
  name: string;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
}

interface BookingCardProps {
  booking: Booking;
  onEdit?: (booking: Booking) => void;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onEdit }) => {
  const start = parseISO(booking.start_date);
  const end = parseISO(booking.end_date);
  const persons: PersonDetails[] = typeof booking.persons_details === 'string'
    ? JSON.parse(booking.persons_details)
    : booking.persons_details || [];

  const { user } = useAuth();
  const namedPersons = persons.filter(p => p.name !== 'Adulte' && p.name !== 'Enfant');
  const unnamedAdults = booking.adults - namedPersons.filter(p => p.name !== 'Enfant').length;
  const unnamedChildren = booking.children - namedPersons.filter(p => p.name !== 'Adulte').length;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const updateBookingStatus = useUpdateBookingStatus();
  const queryClient = useQueryClient();

  const translateTimeLabel = (time: string) => {
    switch (time) {
      case 'morning': return 'Matin';
      case 'afternoon': return 'Après-midi';
      case 'evening': return 'Soir';
      default: return time;
    }
  };

  const handleCardClick = () => {
    setDialogOpen(true);
  };

  return (
    <>
      <Card variant="outlined" sx={{ mb: 2, cursor: 'pointer' }} onClick={handleCardClick}>
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" spacing={2}>
              <Event fontSize="small" />
              <Typography variant="body2">
                {format(start, 'dd/MM/yyyy')} ({translateTimeLabel(booking.arrival_time)}) 
                → {format(end, 'dd/MM/yyyy')} ({translateTimeLabel(booking.departure_time)})
              </Typography>
            </Stack>

            <Stack direction="row" spacing={2}>
              <People fontSize="small" />
                <Typography variant="body2">
                  {booking.adults + booking.children} participants : {booking.adults} adultes / {booking.children} enfants
                </Typography>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <>
                {namedPersons.map((p, idx) => (
                  <Chip key={idx} label={p.name} size="small" sx={{ mb: 0.5 }} />
                ))}
                {unnamedAdults > 0 && (
                  <Chip label={`${unnamedAdults} adulte${unnamedAdults > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />
                )}
                {unnamedChildren > 0 && (
                  <Chip label={`${unnamedChildren} enfant${unnamedChildren > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />
                )}
              </>
            </Stack>

            <Stack direction="row" spacing={2}>
              <MonetizationOn fontSize="small" />
              <Typography variant="body2">
                Coût total : {booking.total_cost || 0} €
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2">Statut :</Typography>
              <Chip label={getStatusLabel(booking.status)} color={getChipColor(booking.status)} size="small" />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <BookingDialog
        open={dialogOpen}
        booking={booking}
        onClose={() => setDialogOpen(false)}
        onEdit={() => {
          if (onEdit) onEdit(booking);  // ✅ déclenche la fonction fournie depuis DashboardPage
          setDialogOpen(false);         // ✅ ferme la modale
        }}
        onUpdateStatus={(newStatus) => {
          updateBookingStatus.mutate(
            { id: booking.id, status: newStatus },
            {
              onSuccess: () => {
                enqueueSnackbar('Statut modifié avec succès', { variant: 'success' });
              },
              onSettled: () => {
                //queryClient.invalidateQueries({ queryKey: ['bookings'] });
                //queryClient.invalidateQueries({ queryKey: ['bookings', booking.user_id] });
                //queryClient.invalidateQueries({ queryKey: ['bookings', undefined] });
                queryClient.invalidateQueries({ queryKey: ['bookings', user?.id] });
                setDialogOpen(false);
              }
            }
          );
        }}

      />


    </>
  );
};
