// src/pages/AdminBookingsPage.tsx
import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Select, MenuItem, Stack, Card, CardContent,
  FormControl, InputLabel, TextField, Button, Tooltip, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material';
import { Event, People, MonetizationOn, EditOutlined, InfoOutlined, Restore, Cancel as CancelIcon } from '@mui/icons-material';
import { ConfirmDialog } from '../components/ConfirmDialog';

import { useAdminBookings } from '../hooks/useBookings';
import { useUpdateBookingStatus } from '../hooks/useUpdateBookingStatus';
import { useUpdateBooking } from '../hooks/useUpdateBooking';
import { EditBookingDialog } from '../components/EditBookingDialog';
import type { Booking, SejourStatus } from '../types/booking';
import { format, parseISO } from 'date-fns';
import { getStatusLabel, getChipColor, calculateBookingBreakdown, type PriceBreakdownRow, calculateBookingCost } from '../utils/bookingUtils';
import { useSnackbar } from 'notistack';

interface PersonDetails {
  name: string;
  [key: string]: any;
}

export const AdminBookingsPage: React.FC = () => {
  const { data: bookings = [], isLoading } = useAdminBookings();
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'completed'>('all');
  const [userFilter, setUserFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const updateStatus = useUpdateBookingStatus({ scope: 'admin' }); // ✅ objet scope, plus de TS2345
  const { enqueueSnackbar } = useSnackbar();
  const updateBooking = useUpdateBooking({ scope: 'admin' });
  const [editOpen, setEditOpen] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [priceDialogFor, setPriceDialogFor] = useState<Booking | null>(null);
  const [discountRateById, setDiscountRateById] = useState<Record<string, number>>({});
  const [cancelFor, setCancelFor] = useState<Booking | null>(null);

  const filtered = useMemo(() => {
    return bookings.filter(b => {
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'paid' && b.status === 'paid') ||
        (statusFilter === 'pending' && b.status === 'pending') ||
        (statusFilter === 'completed' && new Date(b.end_date) < new Date());

      const matchUser =
        userFilter === '' ||
        (b.profiles?.full_name?.toLowerCase() ?? '').includes(userFilter.toLowerCase());

      const bookingDate = new Date(b.start_date);
      const matchYear = yearFilter === '' || bookingDate.getFullYear().toString() === yearFilter;
      const matchMonth =
        monthFilter === '' ||
        (bookingDate.getMonth() + 1).toString().padStart(2, '0') === monthFilter;

      return matchStatus && matchUser && matchYear && matchMonth;
    });
  }, [bookings, statusFilter, userFilter, yearFilter, monthFilter]);

  const handleStatusToggle = (booking: Booking) => {
    const newStatus: SejourStatus = booking.status === 'paid' ? 'pending' : 'paid';
    updateStatus.mutate(
      { id: booking.id, status: newStatus },
      {
        onSuccess: () => {
          enqueueSnackbar('Statut mis à jour', { variant: 'success' });
        },
      }
    );
  };
  const handleRestore = (booking: Booking) => {
    updateStatus.mutate(
      { id: booking.id, status: 'pending' },
      { onSuccess: () => enqueueSnackbar('Séjour restauré', { variant: 'success' }) }
    );
  };

  const handleCancel = (booking: Booking) => {
    setCancelFor(booking);
  };
  const confirmCancel = () => {
    if (!cancelFor) return;
    updateStatus.mutate(
      { id: cancelFor.id, status: 'cancelled' },
      { onSuccess: () => enqueueSnackbar('Séjour annulé', { variant: 'success' }) }
    );
    setCancelFor(null);
  };

  const handleApplyDiscount = async (b: Booking) => {
    const rate = discountRateById[b.id] ?? (b.discount_rate ?? 0); // 0..1
    // 1) base en recalculant depuis persons_details (source de vérité)
    const persons = (typeof b.persons_details === 'string'
      ? JSON.parse(b.persons_details)
      : b.persons_details) || [];
    const base = await calculateBookingCost(persons);
    // 2) net = base * (1 - rate)
    const net = Math.max(0, Math.round(base * (1 - rate)));
    // 3) update
    updateBooking.mutate(
      { id: b.id, data: { base_total_cost: base, discount_rate: rate, total_cost: net } },
      { onSuccess: () => enqueueSnackbar('Remise appliquée', { variant: 'success' }) }
    );
  };

  if (isLoading) {
    return (
      <Box p={2} display="flex" alignItems="center" gap={2}>
        <CircularProgress size={20} />
        <Typography>Chargement des réservations…</Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Gestion des séjours (Admin)</Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={2}>
        <FormControl fullWidth>
          <InputLabel>Statut</InputLabel>
          <Select
            value={statusFilter}
            label="Statut"
            onChange={e => setStatusFilter(e.target.value as any)}
          >
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
          const persons: PersonDetails[] =
            typeof b.persons_details === 'string'
              ? JSON.parse(b.persons_details)
              : b.persons_details || [];
          const namedPersons = persons.filter(p => p.name !== 'Adulte' && p.name !== 'Enfant');
          const genericAdults = persons.filter(p => p.name === 'Adulte').length;
          const genericChildren = persons.filter(p => p.name === 'Enfant').length;

          return (
             <Card
               key={b.id}
               variant="outlined"
               sx={{
                 borderColor: '#1976d2',
                 opacity: b.status === 'cancelled' ? 0.6 : 1,
                 filter: b.status === 'cancelled' ? 'grayscale(0.3)' : 'none'
                 }}
               >
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" fontWeight={600}>
                      {b.profiles?.full_name || 'Nom non renseigné'}
                    </Typography>
                    <Chip label={getStatusLabel(b.status)} color={getChipColor(b.status)} size="small" />

                    {/* ✅ Si le séjour est payé ET qu'il a une remise, on l'affiche ici */}
                    {b.status === 'paid' && (b.discount_rate ?? 0) > 0 && (
                      <Chip
                        size="small"
                        color="warning"
                        label={`Remise ${Math.round((b.discount_rate ?? 0) * 100)}%`}
                      />
                    )}
                  </Stack>

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
                    {namedPersons.map((p, idx) => (
                      <Chip key={`${p.name}-${idx}`} label={p.name} size="small" sx={{ mb: 0.5 }} />
                    ))}
                    {genericAdults > 0 && (
                      <Chip label={`${genericAdults} adulte${genericAdults > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />
                    )}
                    {genericChildren > 0 && (
                      <Chip label={`${genericChildren} enfant${genericChildren > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />
                    )}
                  </Stack>

                  {b.status !== 'cancelled' && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <MonetizationOn fontSize="small" />
                      <Typography variant="body2">Coût total : {b.total_cost || 0} €</Typography>
                    </Stack>
                  )}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" flexWrap="wrap">
                      {/* Boutons statut */}
                      {b.status === 'cancelled' ? (
                        <Tooltip title="Restaurer le séjour">
                          <Button
                            variant="contained"
                            size="small"
                            color="info"
                            startIcon={<Restore />}
                            onClick={() => handleRestore(b)}
                            sx={{ textTransform: 'none' }}
                          >
                            Restaurer
                          </Button>
                        </Tooltip>
                      ) : (
                        <Tooltip title={b.status === 'paid' ? 'Marquer comme non payé' : 'Marquer comme payé'}>
                          <Button
                            variant={b.status === 'paid' ? 'outlined' : 'contained'}
                            size="small"
                            color={b.status === 'paid' ? 'warning' : 'success'}
                            startIcon={ <EditOutlined /> } 
                            onClick={() => handleStatusToggle(b)}
                            sx={{ textTransform: 'none' }}
                          >
                            {b.status === 'paid' ? 'Marquer comme non payé' : 'Marquer comme payé'}
                          </Button>
                        </Tooltip>
                      )}
                  
                      {b.status !== 'cancelled' && b.status !== 'paid' && (
                        <Tooltip title="Annuler le séjour">
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<CancelIcon />}
                            onClick={() => handleCancel(b)}
                            sx={{ textTransform: 'none' }}
                          >
                            Annuler
                          </Button>
                        </Tooltip>
                      )}

                      {/* Modifier (joli + grisé si annulé) */}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditOutlined />}
                        onClick={() => { setBookingToEdit(b); setEditOpen(true); }}
                        disabled={b.status === 'cancelled' || b.status === 'paid'}
                        sx={{ textTransform: 'none' }}
                      >
                        Modifier
                      </Button>
                  
                      {/* Facteur de prix */}
                        {b.status !== 'cancelled' && b.status !== 'paid' && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Select
                              size="small"
                              value={String(discountRateById[b.id] ?? (b.discount_rate ?? 0))}
                              onChange={(e) => {
                                const v = Number(e.target.value); // 0, 0.1, 0.25, 0.5, 1
                                setDiscountRateById(prev => ({ ...prev, [b.id]: v }));
                              }}
                              sx={{ minWidth: 120 }}
                            >
                              <MenuItem value="0">Remise 0%</MenuItem>
                              <MenuItem value="0.1">Remise 10%</MenuItem>
                              <MenuItem value="0.25">Remise 25%</MenuItem>
                              <MenuItem value="0.5">Remise 50%</MenuItem>
                              <MenuItem value="1">Remise 100%</MenuItem>
                            </Select>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleApplyDiscount(b)}
                              sx={{ textTransform: 'none' }}
                            >
                              Appliquer la remise
                            </Button>
                          </Stack>
                        )}

                    {b.status !== 'cancelled' && (
                      <Box mt={1} display="flex" justifyContent="flex-end">
                        <Button
                          variant="text"
                          size="small"
                          startIcon={<InfoOutlined />}
                          onClick={() => setPriceDialogFor(b)}
                          sx={{ textTransform: 'none', ml: { xs: 0, sm: 'auto' } }}
                        >
                          Comprendre le prix
                        </Button>
                      </Box>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* Modale d’édition admin */}
      {editOpen && bookingToEdit && (
        <EditBookingDialog
          open
          booking={bookingToEdit}
          scope={{ type: 'admin' }}
          onClose={() => {
            setEditOpen(false);
            setBookingToEdit(null);
          }}
        />
      )}
      {priceDialogFor && (
        <PriceDetailsDialog
          booking={priceDialogFor}
          onClose={() => setPriceDialogFor(null)}
        />
      )}
        <ConfirmDialog
          open={!!cancelFor}
          title="Annuler le séjour"
          message={cancelFor ? `Confirmez-vous l'annulation du séjour de ${cancelFor.profiles?.full_name ?? 'cet utilisateur'} ?` : ''}
          confirmLabel="Annuler le séjour"
          onCancel={() => setCancelFor(null)}
          onConfirm={confirmCancel}
        />
    </Box>
  );
};


// Module spécifique pour comprendre le prix payé. 

const PriceDetailsDialog: React.FC<{ booking: Booking; onClose: () => void }> = ({ booking, onClose }) => {
  const [rows, setRows] = React.useState<PriceBreakdownRow[]>([]);
  // On garde "total" pour le total NET affiché en bas (facilite l'UI)
  const [total, setTotal] = React.useState<number>(0);
  // En-tête récap : base, taux, montant remisé, net
  const [header, setHeader] = React.useState<{
    baseTotal: number;
    rate: number;
    discountAmount: number;
    netTotal: number;
  } | null>(null);

  // Labels d'heures FR
  const timeLabel = React.useMemo(
    () =>
      ({
        morning: 'Matin',
        afternoon: 'Après-midi',
        evening: 'Soir',
      } as const),
    []
  );

  React.useEffect(() => {
    (async () => {
      const persons =
        (typeof booking.persons_details === 'string'
          ? JSON.parse(booking.persons_details)
          : booking.persons_details) || [];

      // 👉 Breakdown retourne le total de BASE (sans remise)
      const { rows, total: baseTotal } = await calculateBookingBreakdown(persons);

      const rate = booking.discount_rate ?? 0; // 0..1
      const discountAmount = Math.round(baseTotal * rate);
      const netTotal = Math.max(0, baseTotal - discountAmount);

      setRows(rows);
      setHeader({ baseTotal, rate, discountAmount, netTotal });
      setTotal(netTotal); // affiché dans la ligne "Total après ristourne"
    })();
    // re-calcule si les personnes ou le taux changent
  }, [booking.persons_details, booking.discount_rate]);

  // Dérivés lisibles pour le rendu (évite les "?.")
  const baseTotal = header?.baseTotal ?? 0;
  const rate = header?.rate ?? 0;
  const discountAmount = header?.discountAmount ?? 0;
  const netTotal = header?.netTotal ?? total;

  // Remise active ?
  const hasDiscount = rate > 0.0001;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Comprendre le prix</DialogTitle>
      <DialogContent>
        {/* Légende séjour (global) */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Séjour : {format(parseISO(booking.start_date), 'dd/MM/yyyy')} ({timeLabel[booking.arrival_time]}) →{' '}
          {format(parseISO(booking.end_date), 'dd/MM/yyyy')} ({timeLabel[booking.departure_time]})
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Participant</TableCell>
              <TableCell align="right">Nuits</TableCell>
              <TableCell align="right">Prix/nuit</TableCell>
              <TableCell align="right">Sous-total nuits</TableCell>
              <TableCell align="right">Jours</TableCell>
              <TableCell align="right">Prix/jour</TableCell>
              <TableCell align="right">Sous-total jours</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((r, i) => {
              const a = parseISO(r.arrivalDate);
              const d = parseISO(r.departureDate);
              return (
                <TableRow key={i}>
                  <TableCell>
                    <Typography>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(a, 'dd/MM/yyyy')} ({timeLabel[r.arrivalTime]}) → {format(d, 'dd/MM/yyyy')} (
                      {timeLabel[r.departureTime]})
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{r.nights}</TableCell>
                  <TableCell align="right">{r.night_price} €</TableCell>
                  <TableCell align="right">{r.subtotal_nights} €</TableCell>
                  <TableCell align="right">{r.days}</TableCell>
                  <TableCell align="right">{r.day_price} €</TableCell>
                  <TableCell align="right">{r.subtotal_days} €</TableCell>
                  <TableCell align="right">
                    <Typography component="div" fontWeight={600}>
                      {r.total} €
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Pied de tableau : totaux de séjour */}
            <TableRow>
              <TableCell colSpan={7} align="right">
                <b>Total standard</b>
              </TableCell>
              <TableCell align="right">
                <b>{baseTotal} €</b>
              </TableCell>
            </TableRow>

            {hasDiscount && (
              <>
                <TableRow>
                  <TableCell colSpan={7} align="right">
                    <b>Ristourne</b> ({Math.round(rate * 100)}%)
                  </TableCell>
                  <TableCell align="right">
                    <b>-{discountAmount} €</b>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} align="right">
                    <b>Total après ristourne</b>
                  </TableCell>
                  <TableCell align="right">
                    <b>{netTotal} €</b>
                  </TableCell>
                </TableRow>
              </>
            )}

            {!hasDiscount && (
              <TableRow>
                <TableCell colSpan={7} align="right">
                  <b>Total à payer</b>
                </TableCell>
                <TableCell align="right">
                  <b>{baseTotal} €</b>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
};


