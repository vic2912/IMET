// src/pages/AllBookingsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Box, Typography, Stack, Card, CardContent, Chip, Button,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableRow, TableCell, TableBody, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
  Event, People, MonetizationOn, EditOutlined, InfoOutlined,
  Cancel as CancelIcon, Visibility
} from '@mui/icons-material';

import { useAuth } from '../hooks/useAuth';
import { useBookings, useAdminBookings } from '../hooks/useBookings';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EditBookingDialog } from '../components/EditBookingDialog';
import type { Booking, SejourStatus } from '../types/booking';
import { useUpdateBookingStatus } from '../hooks/useUpdateBookingStatus';
import { format, parseISO } from 'date-fns';
import { useSnackbar } from 'notistack';
import { calculateBookingBreakdown, type PriceBreakdownRow, getStatusLabel, getChipColor } from '../utils/bookingUtils';


// -------- Dialog Comprendre le prix (identique à ta version utilisateur) --------
const PriceDetailsDialog: React.FC<{ booking: Booking; onClose: () => void }> = ({ booking, onClose }) => {
  const [rows, setRows] = React.useState<PriceBreakdownRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [header, setHeader] = React.useState<{
    baseTotal: number; rate: number; discountAmount: number; netTotal: number;
  } | null>(null);

  const timeLabel = React.useMemo(
    () => ({ morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir' } as const),
    []
  );

  React.useEffect(() => {
    (async () => {
      const persons =
        (typeof booking.persons_details === 'string'
          ? JSON.parse(booking.persons_details)
          : booking.persons_details) || [];
      const { rows, total: baseTotal } = await calculateBookingBreakdown(persons);
      const rate = booking.discount_rate ?? 0;
      const discountAmount = Math.round(baseTotal * rate);
      const netTotal = Math.max(0, baseTotal - discountAmount);

      setRows(rows);
      setHeader({ baseTotal, rate, discountAmount, netTotal });
      setTotal(netTotal);
    })();
  }, [booking.persons_details, booking.discount_rate]);

  const baseTotal = header?.baseTotal ?? 0;
  const rate = header?.rate ?? 0;
  const discountAmount = header?.discountAmount ?? 0;
  const netTotal = header?.netTotal ?? total;
  const hasDiscount = rate > 0.0001;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Comprendre le prix</DialogTitle>
      <DialogContent>
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
                      {format(a, 'dd/MM/yyyy')} ({r.arrivalTime === 'morning' ? 'Matin' : r.arrivalTime === 'afternoon' ? 'Après-midi' : 'Soir'}) →{' '}
                      {format(d, 'dd/MM/yyyy')} ({r.departureTime === 'morning' ? 'Matin' : r.departureTime === 'afternoon' ? 'Après-midi' : 'Soir'})
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{r.nights}</TableCell>
                  <TableCell align="right">{r.night_price} €</TableCell>
                  <TableCell align="right">{r.subtotal_nights} €</TableCell>
                  <TableCell align="right">{r.days}</TableCell>
                  <TableCell align="right">{r.day_price} €</TableCell>
                  <TableCell align="right">{r.subtotal_days} €</TableCell>
                  <TableCell align="right">
                    <Typography component="div" fontWeight={600}>{r.total} €</Typography>
                  </TableCell>
                </TableRow>
              );
            })}

            <TableRow>
              <TableCell colSpan={7} align="right"><b>Total standard</b></TableCell>
              <TableCell align="right"><b>{baseTotal} €</b></TableCell>
            </TableRow>

            {hasDiscount ? (
              <>
                <TableRow>
                  <TableCell colSpan={7} align="right"><b>Remise</b> ({Math.round(rate * 100)}%)</TableCell>
                  <TableCell align="right"><b>-{discountAmount} €</b></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} align="right"><b>Total après Remise</b></TableCell>
                  <TableCell align="right"><b>{netTotal} €</b></TableCell>
                </TableRow>
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="right"><b>Total à payer</b></TableCell>
                <TableCell align="right"><b>{baseTotal} €</b></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Fermer</Button></DialogActions>
    </Dialog>
  );
};

// -------- Dialog Détails (pour les séjours des autres) --------
const ParticipantsDetailsDialog: React.FC<{ booking: Booking; onClose: () => void }> = ({ booking, onClose }) => {
  const persons = React.useMemo(() => {
    const raw = (typeof booking.persons_details === 'string'
      ? JSON.parse(booking.persons_details)
      : booking.persons_details) || [];
    return Array.isArray(raw) ? raw : [];
  }, [booking.persons_details]);

  const label = (t?: 'morning'|'afternoon'|'evening') =>
    t === 'morning' ? 'Matin' : t === 'afternoon' ? 'Après-midi' : t === 'evening' ? 'Soir' : '';

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Détails des participants</DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nom</TableCell>
              <TableCell>Arrivée</TableCell>
              <TableCell>Départ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {persons.map((p: any, idx: number) => (
              <TableRow key={idx}>
                <TableCell>{p.name ?? '—'}</TableCell>
                <TableCell>
                  {p.arrivalDate ? format(parseISO(p.arrivalDate), 'dd/MM/yyyy') : '—'}
                  {p.arrivalTime ? ` (${label(p.arrivalTime)})` : ''}
                </TableCell>
                <TableCell>
                  {p.departureDate ? format(parseISO(p.departureDate), 'dd/MM/yyyy') : '—'}
                  {p.departureTime ? ` (${label(p.departureTime)})` : ''}
                </TableCell>
              </TableRow>
            ))}
            {persons.length === 0 && (
              <TableRow><TableCell colSpan={3} align="center">Aucun participant</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Fermer</Button></DialogActions>
    </Dialog>
  );
};

export const AllBookingsPage: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const userId = user?.id;

  // Données : mes séjours (hook user-scopé) + tous les séjours (hook admin)
  const { data: myBookings = [], isLoading: isLoadingMine } = useBookings(userId);
  const { data: allBookings = [], isLoading: isLoadingAll } = useAdminBookings();

  const [view, setView] = useState<'mine' | 'all'>('all');
  const [priceDialogFor, setPriceDialogFor] = useState<Booking | null>(null);
  const [detailsFor, setDetailsFor] = useState<Booking | null>(null);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [cancelFor, setCancelFor] = useState<Booking | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const updateStatus = useUpdateBookingStatus(
    userId ? { scope: 'user', userId } : { scope: 'all' }
  );

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Quelle liste afficher ?
  const visible = useMemo(() => (view === 'mine' ? myBookings : allBookings), [view, myBookings, allBookings]);

  // Tri chronologique strict (du plus ancien au plus récent)
  const sorted = useMemo(() => {
    const safeTime = (d: string) => {
      const t = Date.parse(d);
      return Number.isFinite(t) ? t : 0;
    };
    return [...visible].sort((a, b) => {
      const aStart = safeTime(a.start_date);
      const bStart = safeTime(b.start_date);
      if (aStart !== bStart) return aStart - bStart;
      // égalité: on départage sur end_date
      return safeTime(a.end_date) - safeTime(b.end_date);
    });
  }, [visible]);

  // Scroll auto vers le premier séjour >= aujourd'hui (sinon le tout premier)
 useEffect(() => {
   if (!sorted.length) return;
   const nowTs = Date.now();
   const target = sorted.find(b => Date.parse(b.start_date) >= nowTs) ?? sorted[0];
   let raf = 0;
   let tries = 0;
   const tryScroll = () => {
     if (!target?.id) return;
     const el = cardRefs.current[target.id];
     if (el) {
       el.scrollIntoView({ behavior: 'smooth', block: 'start' });
     } else if (tries++ < 20) {
       raf = requestAnimationFrame(tryScroll); // réessaye le frame suivant
     }
   };
   raf = requestAnimationFrame(tryScroll);
   return () => cancelAnimationFrame(raf);
 }, [sorted, view]);

  // Actions utilisateur (identiques à ta page “Mes séjours”)
  const handleStatusToggle = (booking: Booking) => {
    if (booking.status === 'cancelled') return;
    const newStatus: SejourStatus = booking.status === 'paid' ? 'pending' : 'paid';
    updateStatus.mutate(
      { id: booking.id, status: newStatus },
      {
        onSuccess: () =>
          enqueueSnackbar(
            newStatus === 'paid' ? 'Séjour marqué comme payé' : 'Séjour marqué comme non payé',
            { variant: 'success' }
          ),
      }
    );
  };
  const handleCancel = (booking: Booking) => {
    if (booking.status === 'cancelled') return;
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

  if (loading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  const isLoading = view === 'mine' ? isLoadingMine : isLoadingAll;

  const renderHeader = (b: Booking, isMine: boolean) => (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="subtitle1" fontWeight={600}>
        {b.profiles?.full_name || 'Nom non renseigné'}
      </Typography>
      {isMine && <Chip label={getStatusLabel(b.status)} color={getChipColor(b.status)} size="small" />}
      {isMine && b.status === 'paid' && (b.discount_rate ?? 0) > 0 && (
        <Chip size="small" color="warning" label={`Remise ${Math.round((b.discount_rate ?? 0) * 100)}%`} />
      )}
    </Stack>
  );
  
  const renderBody = (b: Booking, isMine: boolean) => {
    const start = parseISO(b.start_date);
    const end = parseISO(b.end_date);
    const persons =
      (typeof b.persons_details === 'string' ? JSON.parse(b.persons_details) : b.persons_details) || [];
    const namedPersons = persons.filter((p: any) => p.name !== 'Adulte' && p.name !== 'Enfant');
    const genericAdults = persons.filter((p: any) => p.name === 'Adulte').length;
    const genericChildren = persons.filter((p: any) => p.name === 'Enfant').length;

    
    return (
      <Stack spacing={1}>
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
          {namedPersons.map((p: any, idx: number) => (
            <Chip key={`${p.name}-${idx}`} label={p.name} size="small" sx={{ mb: 0.5 }} />
          ))}
          {genericAdults > 0 && (
            <Chip label={`${genericAdults} adulte${genericAdults > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />
          )}
          {genericChildren > 0 && (
            <Chip label={`${genericChildren} enfant${genericChildren > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />
          )}
        </Stack>

        {isMine && b.status !== 'cancelled' && (
          <Stack direction="row" spacing={1} alignItems="center">
            <MonetizationOn fontSize="small" />
            <Typography variant="body2">Coût total : {b.total_cost || 0} €</Typography>
          </Stack>
        )}
      </Stack>
    );
  };

  const renderActionsMine = (b: Booking) => (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" flexWrap="wrap">
      {b.status !== 'cancelled' && (
        <Button
          variant={b.status === 'paid' ? 'outlined' : 'contained'}
          size="small"
          color={b.status === 'paid' ? 'warning' : 'success'}
          startIcon={<EditOutlined />}
          onClick={() => handleStatusToggle(b)}
          sx={{ textTransform: 'none' }}
        >
          {b.status === 'paid' ? 'Marquer comme non payé' : 'Marquer comme payé'}
        </Button>
      )}

      {b.status !== 'cancelled' && (
        <Button
          variant="outlined" size="small" color="error" startIcon={<CancelIcon />}
          onClick={() => handleCancel(b)} disabled={b.status === 'paid'}
          sx={{ textTransform: 'none' }}
        >
          Annuler
        </Button>
      )}

      <Button
        variant="outlined" size="small" startIcon={<EditOutlined />}
        onClick={() => { setBookingToEdit(b); setShowEditDialog(true); }}
        disabled={b.status === 'cancelled' || b.status === 'paid'}
        sx={{ textTransform: 'none' }}
      >
        Modifier
      </Button>

      {b.status !== 'cancelled' && (
        <Box mt={1} display="flex" justifyContent="flex-end">
          <Button
            variant="text" size="small" startIcon={<InfoOutlined />}
            onClick={() => setPriceDialogFor(b)}
            sx={{ textTransform: 'none', ml: { xs: 0, sm: 'auto' } }}
          >
            Comprendre le prix
          </Button>
        </Box>
      )}
    </Stack>
  );

  const renderActionsOthers = (b: Booking) => (
    <Box mt={1} display="flex" justifyContent="flex-end">
      <Button
        variant="outlined" size="small" startIcon={<Visibility />}
        onClick={() => setDetailsFor(b)}
        sx={{ textTransform: 'none' }}
      >
        Détails
      </Button>
    </Box>
  );

  return (
    <Box p={2}>
      {/* Sticky toggle */}
      <Box
        sx={{
          position: 'sticky', top: 0, zIndex: 5, bgcolor: 'background.paper',
          pb: 1.5, pt: 1, mb: 2, borderBottom: theme => `1px solid ${theme.palette.divider}`
        }}
      >
        <Typography variant="h5" gutterBottom>Vue des séjours</Typography>
        <ToggleButtonGroup
          exclusive value={view}
          onChange={(_, v) => { if (v) setView(v); }}
          size="small"
          sx={{ mt: 0.5 }}
        >
          <ToggleButton value="mine">Mes séjours</ToggleButton>
          <ToggleButton value="all">Tous les séjours</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {isLoading ? (
        <Box p={2} display="flex" alignItems="center" gap={2}>
          <CircularProgress size={20} />
          <Typography>Chargement des séjours…</Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {sorted.map((b: Booking) => {
            const isMine = b.user_id === userId;


            return (
              <Card
                key={b.id}
                variant="outlined"
                ref={(el) => { cardRefs.current[b.id] = el; }}  
                sx={{
                  borderColor: '#1976d2',
                  opacity: b.status === 'cancelled' ? 0.6 : 1,
                  filter: b.status === 'cancelled' ? 'grayscale(0.3)' : 'none',
                }}
              >
                <CardContent>
                  <Stack spacing={1}>
                    {renderHeader(b, isMine)}
                    {renderBody(b, isMine)}
                    {isMine ? renderActionsMine(b) : renderActionsOthers(b)}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}

          {sorted.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ mt: 4 }}>
              Aucun séjour à afficher.
            </Typography>
          )}
        </Stack>
      )}

      {/* Dialogs */}
      {bookingToEdit && showEditDialog && (
        <EditBookingDialog
          open={true}
          booking={bookingToEdit}
          onClose={() => {
            setShowEditDialog(false);
            setBookingToEdit(null);
          }}
        />
      )}

      {priceDialogFor && (
        <PriceDetailsDialog booking={priceDialogFor} onClose={() => setPriceDialogFor(null)} />
      )}

      <ConfirmDialog
        open={!!cancelFor}
        title="Annuler le séjour"
        message={cancelFor ? `Confirmez-vous l'annulation de votre séjour du ${format(parseISO(cancelFor.start_date),'dd/MM/yyyy')} au ${format(parseISO(cancelFor.end_date),'dd/MM/yyyy')} ?` : ''}
        confirmLabel="Annuler le séjour"
        onCancel={() => setCancelFor(null)}
        onConfirm={confirmCancel}
      />

      {detailsFor && (
        <ParticipantsDetailsDialog booking={detailsFor} onClose={() => setDetailsFor(null)} />
      )}
    </Box>
  );
};

export default AllBookingsPage;
