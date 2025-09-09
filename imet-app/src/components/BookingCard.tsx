// src/components/BookingCard.tsx

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, Stack, Typography, Chip } from '@mui/material';
import { Event, People, MonetizationOn } from '@mui/icons-material';
import { parseISO, format } from 'date-fns';
import { BookingDialog } from './BookingDialog';
import { getStatusLabel, getChipColor } from '../utils/bookingUtils';
import { useUpdateBookingStatus } from '../hooks/useUpdateBookingStatus';
import { useSnackbar } from 'notistack';
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
  justPaid?: boolean;
  onJustPaid?: (id: string) => void;
  scope?: { type: 'user'; userId: string } | { type: 'admin' };
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onEdit, justPaid, onJustPaid, scope }) => {
  const start = parseISO(booking.start_date);
  const end = parseISO(booking.end_date);
  const persons: PersonDetails[] = typeof booking.persons_details === 'string'
    ? JSON.parse(booking.persons_details)
    : booking.persons_details || [];

  const genericAdults = persons.filter(p => p.name === 'Adulte').length;
  const genericChildren = persons.filter(p => p.name === 'Enfant').length;
  const namedPersons = persons.filter(p => p.name !== 'Adulte' && p.name !== 'Enfant');

  const [dialogOpen, setDialogOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const resolvedScope =
    scope?.type === 'user'
      ? { scope: 'user' as const, userId: scope.userId }
      : { scope: 'admin' as const };
  const updateBookingStatus = useUpdateBookingStatus(resolvedScope);

  const queryClient = useQueryClient();
  const userKey = scope?.type === 'user' ? (['bookings', 'user', scope.userId] as const) : null;
   const adminKey = ['bookings', 'admin'] as const;
  
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
      <Card variant="outlined" sx={{ mb: 2, cursor: 'pointer', opacity: justPaid ? 0.7 : 1,
          transition: 'opacity 200ms ease', borderStyle: justPaid ? 'dashed' : 'solid'}}
        onClick={handleCardClick} >

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
                {genericAdults > 0 && (
                  <Chip label={`${genericAdults} adulte${genericAdults > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />
                )}
                {genericChildren > 0 && (
                  <Chip label={`${genericChildren} enfant${genericChildren > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />
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
              {justPaid && (
                <Chip label="Payé (à l’instant)" variant="outlined" size="small" sx={{ ml: 1 }} />
              )}
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
                if (newStatus === 'paid') {
                  onJustPaid?.(booking.id);
                }

                // Patch local ultra-ciblé : liste utilisateur si on est en scope user
                if (userKey) {
                  queryClient.setQueryData<Booking[]>(
                    userKey,
                    (old) => (old ?? []).map(b => b.id === booking.id ? { ...b, status: newStatus } : b)
                  );
                }

                // (Optionnel) si cette carte vit aussi dans une vue admin, patcher la liste admin :
                queryClient.setQueryData<Booking[]>(
                  adminKey,
                  (old) => (old ?? []).map(b => b.id === booking.id ? { ...b, status: newStatus } : b)
                );
              },
              onError: () => {
                enqueueSnackbar('Échec de la modification du statut', { variant: 'error' });
              },
              onSettled: () => {
                // Invalidate les clés réellement lues pour forcer une resynchro douce
                if (userKey) {
                  queryClient.invalidateQueries({ queryKey: userKey });
                }
                queryClient.invalidateQueries({ queryKey: adminKey });
                setDialogOpen(false);
              }
            }
          );
        }}
      />
    </>
  );
};
