import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Select, MenuItem, Stack, Card, CardContent, FormControl, InputLabel, TextField, Button, Tooltip, Chip
} from '@mui/material';
import { Event, People, MonetizationOn } from '@mui/icons-material';
import { useBookings } from '../hooks/useBookings';
import { useUpdateBookingStatus } from '../hooks/useUpdateBookingStatus';
import type { Booking, SejourStatus } from '../types/booking';
import { format, parseISO } from 'date-fns';
import { getStatusLabel, getChipColor } from '../utils/bookingUtils';
import { useSnackbar } from 'notistack';

interface PersonDetails {
  name: string;
  [key: string]: any;
}

export const AdminBookingsPage: React.FC = () => {
  const { data: bookings = [] } = useBookings();
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'completed'>('all');
  const [userFilter, setUserFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const updateStatus = useUpdateBookingStatus('admin');
  const { enqueueSnackbar } = useSnackbar();

  const filtered = useMemo(() => {
    return bookings.filter(b => {
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'paid' && b.status === 'paid') ||
        (statusFilter === 'pending' && b.status !== 'paid') ||
        (statusFilter === 'completed' && new Date(b.end_date) < new Date());

      const matchUser = userFilter === '' || b.profiles?.full_name?.toLowerCase().includes(userFilter.toLowerCase());

      const bookingDate = new Date(b.start_date);
      const matchYear = yearFilter === '' || bookingDate.getFullYear().toString() === yearFilter;
      const matchMonth = monthFilter === '' || (bookingDate.getMonth() + 1).toString().padStart(2, '0') === monthFilter;

      return matchStatus && matchUser && matchYear && matchMonth;
    });
  }, [bookings, statusFilter, userFilter, yearFilter, monthFilter]);

  const handleStatusToggle = (booking: Booking) => {
    const newStatus: SejourStatus = booking.status === 'paid' ? 'pending' : 'paid';
    updateStatus.mutate({ id: booking.id, status: newStatus }, {
      onSuccess: () => {
        enqueueSnackbar('Statut mis à jour', { variant: 'success' });
      },
    });
  };

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Gestion des séjours (Admin)</Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={2}>
        <FormControl fullWidth>
          <InputLabel>Statut</InputLabel>
          <Select value={statusFilter} label="Statut" onChange={e => setStatusFilter(e.target.value as any)}>
            <MenuItem value="all">Tous</MenuItem>
            <MenuItem value="paid">Payés</MenuItem>
            <MenuItem value="pending">Non payés</MenuItem>
            <MenuItem value="completed">Réalisés</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Filtrer par nom"
          fullWidth
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        />

        <TextField
          label="Année"
          fullWidth
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
        />

        <TextField
          label="Mois (01 à 12)"
          fullWidth
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        />
      </Stack>

      <Stack spacing={2}>
        {filtered.map((b: Booking) => {
          const start = parseISO(b.start_date);
          const end = parseISO(b.end_date);
          const persons: PersonDetails[] = typeof b.persons_details === 'string' ? JSON.parse(b.persons_details) : b.persons_details || [];
          const namedPersons = persons.filter((p: PersonDetails) => p.name !== 'Adulte' && p.name !== 'Enfant');
          const genericAdults = persons.filter((p: PersonDetails) => p.name === 'Adulte').length;
          const genericChildren = persons.filter((p: PersonDetails) => p.name === 'Enfant').length;

          return (
            <Card key={b.id} variant="outlined" sx={{ borderColor: '#1976d2' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" fontWeight={600}>{b.profiles?.full_name || 'Nom non renseigné'}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Event fontSize="small" />
                    <Typography variant="body2">
                      Du {format(start, 'dd/MM/yyyy')} ({b.arrival_time}) au {format(end, 'dd/MM/yyyy')} ({b.departure_time})
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <People fontSize="small" />
                    <Typography variant="body2">
                      {b.adults + b.children} participants : {b.adults} adultes / {b.children} enfants
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {namedPersons.map((p: PersonDetails, idx: number) => (
                      <Chip key={idx} label={p.name} size="small" sx={{ mb: 0.5 }} />
                    ))}
                    {genericAdults > 0 && (
                      <Chip label={`${genericAdults} adulte${genericAdults > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />
                    )}
                    {genericChildren > 0 && (
                      <Chip label={`${genericChildren} enfant${genericChildren > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />
                    )}
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <MonetizationOn fontSize="small" />
                    <Typography variant="body2">Coût total : {b.total_cost || 0} €</Typography>
                  </Stack>

                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2">Statut :</Typography>
                    <Chip label={getStatusLabel(b.status)} color={getChipColor(b.status)} size="small" />
                    <Tooltip title={b.status === 'paid' ? 'Marquer comme non payé' : 'Marquer comme payé'}>
                      <Button
                        variant="contained"
                        size="small"
                        color={b.status === 'paid' ? 'error' : 'success'}
                        onClick={() => handleStatusToggle(b)}
                        sx={{ textTransform: 'none' }}
                      >
                        {b.status === 'paid' ? 'Marquer comme non payé' : 'Marquer comme payé'}
                      </Button>
                    </Tooltip>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
};
