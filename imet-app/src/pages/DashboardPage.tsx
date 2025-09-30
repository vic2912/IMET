// src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Box, Typography, Fab, Tooltip, Stack, Card, CardContent, Button, Chip, Divider,
  IconButton, Avatar, Skeleton, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableRow, TableCell, TableBody, useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  MonetizationOn,
  Event,
  People,
  InfoOutlined,
  Checklist,
  Login,
  Logout,
  ArrowForwardIos,
  ArrowRightAlt,
  Inventory2,
  EditOutlined, 
  Cancel as CancelIcon
} from '@mui/icons-material';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { format, parseISO, startOfDay, endOfDay, addDays, isBefore, isAfter } from 'date-fns';
import { useSnackbar } from 'notistack';
import { useAuth } from '../hooks/useAuth';
import { useBookings } from '../hooks/useBookings';
import { useUpdateBookingStatus } from '../hooks/useUpdateBookingStatus';
import { supabase } from '../services/supabase';

import type { Booking, SejourStatus } from '../types/booking';
import { getStatusLabel, getChipColor } from '../utils/bookingUtils';
import type { PriceBreakdownRow } from '../utils/bookingUtils';
import {
  calculateBookingBreakdown,
  getUniqueNightList,
} from '../utils/bookingUtils';

import { BookingWizard } from '../components/BookingWizard';
import { EditBookingDialog } from '../components/EditBookingDialog';
import { useTheme } from '@mui/material/styles';

/* ----------------------------- Utils locaux ----------------------------- */
const asArray = (x: any) =>
  (typeof x === 'string' ? JSON.parse(x) : Array.isArray(x) ? x : []) as any[];

const isSameISO = (d: string | Date, isoYYYYMMDD: string) => {
  const s = typeof d === 'string' ? d : format(d, 'yyyy-MM-dd');
  return s.slice(0, 10) === isoYYYYMMDD;
};

const listNames = (people: any[]) => people.map(p => p?.name).filter(Boolean);

const participantCount = (b: Booking) => (b.adults ?? 0) + (b.children ?? 0);

const frTime = (t?: string) =>
  t === 'morning' ? 'Matin'
  : t === 'afternoon' ? 'Après-midi'
  : t === 'evening' ? 'Soir (après diner)'
  : '—';

/* ------------------- Dialog: Comprendre le prix (recyclé) ------------------- */
// ➜ Ajout d'un conteneur scroll horizontal + fullScreen pilotable
const PriceDetailsDialog: React.FC<{ booking: Booking; onClose: () => void; fullScreen?: boolean }> = ({ booking, onClose, fullScreen }) => {
  const [rows, setRows] = React.useState<PriceBreakdownRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [header, setHeader] = React.useState<{ baseTotal: number; rate: number; discountAmount: number; netTotal: number } | null>(null);
  

  const timeLabel = React.useMemo(
    () => ({ morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir' } as const),
    [],
  );

  React.useEffect(() => {
    (async () => {
      const persons = asArray(booking.persons_details);
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
    <Dialog open onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>Comprendre le prix</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Séjour : {format(parseISO(booking.start_date), 'dd/MM/yyyy')} ({timeLabel[booking.arrival_time as 'morning'|'afternoon'|'evening']}) →{' '}
          {format(parseISO(booking.end_date), 'dd/MM/yyyy')} ({timeLabel[booking.departure_time as 'morning'|'afternoon'|'evening']})
        </Typography>

        {/* table responsive: scroll horizontal sur mobile */}
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 720 }}>
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
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ maxWidth: 260 }}>
                    <Typography noWrap title={r.name}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap
                      title={`${format(parseISO(r.arrivalDate), 'dd/MM/yyyy')} (${timeLabel[r.arrivalTime as 'morning'|'afternoon'|'evening']}) → ${format(parseISO(r.departureDate), 'dd/MM/yyyy')} (${timeLabel[r.departureTime as 'morning'|'afternoon'|'evening']})`}>
                      {format(parseISO(r.arrivalDate), 'dd/MM/yyyy')} ({timeLabel[r.arrivalTime as 'morning'|'afternoon'|'evening']}) → {format(parseISO(r.departureDate), 'dd/MM/yyyy')} ({timeLabel[r.departureTime as 'morning'|'afternoon'|'evening']})
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{r.nights}</TableCell>
                  <TableCell align="right">{r.night_price} €</TableCell>
                  <TableCell align="right">{r.subtotal_nights} €</TableCell>
                  <TableCell align="right">{r.days}</TableCell>
                  <TableCell align="right">{r.day_price} €</TableCell>
                  <TableCell align="right">{r.subtotal_days} €</TableCell>
                  <TableCell align="right"><b>{r.total} €</b></TableCell>
                </TableRow>
              ))}
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
                    <TableCell colSpan={7} align="right"><b>Total après remise</b></TableCell>
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
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
};

/* ------------------- Dialog: Mouvements du jour (personnes) ------------------ */
// ➜ Ajout prop fullScreen pour mobile
const MovementsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  arrivals: Array<{ name: string; booking: Booking; owner: string; arrivalDate: string; departureDate: string; arrivalTime?: string; departureTime?: string }>;
  departures: Array<{ name: string; booking: Booking; owner: string; arrivalDate: string; departureDate: string; arrivalTime?: string; departureTime?: string }>;
  dateISO: string;
  fullScreen?: boolean;
}> = ({ open, onClose, arrivals, departures, dateISO, fullScreen }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
    <DialogTitle>Mouvements du {format(parseISO(dateISO), 'dd/MM/yyyy')}</DialogTitle>
    <DialogContent dividers>
      <Typography variant="subtitle1" gutterBottom>Arrivées — {arrivals.length} personne(s)</Typography>
      {arrivals.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Aucune arrivée.</Typography>
      ) : (
        <Stack spacing={1} mb={2}>
          {arrivals.map((p, i) => (
            <Card key={`a-${i}`} variant="outlined">
              <CardContent sx={{ py: 1.25 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" icon={<Login fontSize="small" />} label="Arrive" />
                  <Typography>{p.name}</Typography>
                  <Typography variant="body2" color="text.secondary"> {p.owner}</Typography>
                  <Typography variant="body2" sx={{ ml: 'auto' }}>
                    {format(parseISO(p.arrivalDate), 'dd/MM')} ({frTime(p.arrivalTime)})  → {format(parseISO(p.departureDate), 'dd/MM')} ({frTime(p.departureTime)})
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="subtitle1" gutterBottom>Départs — {departures.length} personne(s)</Typography>
      {departures.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Aucun départ.</Typography>
      ) : (
        <Stack spacing={1}>
          {departures.map((p, i) => (
            <Card key={`d-${i}`} variant="outlined">
              <CardContent sx={{ py: 1.25 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" icon={<Logout fontSize="small" />} label="Part" />
                  <Typography>{p.name}</Typography>
                  <Typography variant="body2" color="text.secondary">— {p.owner}</Typography>
                  <Typography variant="body2" sx={{ ml: 'auto' }}>
                    {format(parseISO(p.arrivalDate), 'dd/MM')} ({frTime(p.arrivalTime)}) → {format(parseISO(p.departureDate), 'dd/MM')} ({frTime(p.departureTime)})
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Fermer</Button>
    </DialogActions>
  </Dialog>
);

/* --------------- Dialog: Voir plus (10 prochains séjours) ---------------- */
// ➜ Ajout prop fullScreen pour mobile
const UpcomingDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  bookings: Booking[];
  onSeeAll: () => void;
  fullScreen?: boolean;
}> = ({ open, onClose, title, bookings, onSeeAll, fullScreen }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.25}>
          {bookings.slice(0, 10).map((b) => {
            const start = parseISO(b.start_date);
            const end = parseISO(b.end_date);
            const persons = (b.adults ?? 0) + (b.children ?? 0);
            const names = asArray(b.persons_details)
              .map((p: any) => p?.name)
              .filter((n: string) => !!n && n !== 'Adulte' && n !== 'Enfant');

            return (
              <Card key={b.id} variant="outlined">
                <CardContent sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 28, height: 28 }}><People fontSize="small" /></Avatar>
                    <Stack flex={1} spacing={0.25} sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap title={b.profiles?.full_name || 'Séjour'}>
                        {b.profiles?.full_name || 'Séjour'}
                      </Typography>
                      <Typography variant="caption">
                        {format(start, 'dd/MM')} → {format(end, 'dd/MM')} • {persons} pers.
                      </Typography>
                      {!!names.length && (
                        <Typography variant="caption" color="text.secondary" noWrap title={names.join(', ')}>
                          {names.slice(0, 4).join(', ')}{names.length > 4 ? ` +${names.length - 4}` : ''}
                        </Typography>
                      )}
                    </Stack>
                    <IconButton size="small" onClick={onSeeAll}>
                      <ArrowRightAlt fontSize="small" />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
        <Button variant="contained" onClick={onSeeAll}>Tout voir</Button>
      </DialogActions>
    </Dialog>
  );
};

/* ----------------------- Carte séjour compacte ----------------------- */
 const MiniBookingCard: React.FC<{
   b: Booking;
   showMaxBadge?: boolean;
 }> = ({ b, showMaxBadge }) => {
  const start = parseISO(b.start_date);
  const end = parseISO(b.end_date);
  const persons = participantCount(b);
  const names = listNames(asArray(b.persons_details)).filter(n => n !== 'Adulte' && n !== 'Enfant');

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Avatar sx={{ width: 28, height: 28 }}><People fontSize="small" /></Avatar>
          <Stack flex={1} spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={b.profiles?.full_name || 'Séjour'}>
              {b.profiles?.full_name || ''}
            </Typography>
            <Typography variant="caption">
              {format(start, 'dd/MM')} → {format(end, 'dd/MM')} • {persons} pers.
            </Typography>
            {!!names.length && (
              <Typography variant="caption" color="text.secondary" noWrap title={names.join(', ')}>
                {names.slice(0, 4).join(', ')}{names.length > 4 ? ` +${names.length - 4}` : ''}
              </Typography>
            )}
          </Stack>
        </Stack>
        {showMaxBadge && persons >= 13 && (
          <Chip size="small" color="error" label="≥13 (attention)" sx={{ mt: 1 }} />
        )}
      </CardContent>
    </Card>
  );
};

/* ================================ PAGE ================================ */
export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { data: myBookings = [] } = useBookings(user?.id);
  const updateStatus = useUpdateBookingStatus(user?.id ? { scope: 'user', userId: user.id } : { scope: 'all' });

  // “Maison” : on charge tous les séjours qui recouvrent [aujourd’hui ; +30j]
  const [houseBookings, setHouseBookings] = useState<Booking[]>([]);
  const [loadingHouse, setLoadingHouse] = useState(true);

  // Inventaire : items épuisés
  type InventoryItem = { id: string; name: string; stock: number; min_threshold?: number | null };
  const [outOfStock, setOutOfStock] = useState<InventoryItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);

  // UI state
  const [showWizard, setShowWizard] = useState(false);
  const [priceDialogFor, setPriceDialogFor] = useState<Booking | null>(null);
  const [editFor, setEditFor] = useState<Booking | null>(null);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [cancelFor, setCancelFor] = useState<Booking | null>(null);
  const [openMyUpcoming, setOpenMyUpcoming] = useState(false);
  const [openHouseUpcoming, setOpenHouseUpcoming] = useState(false);
  const [toggleFor, setToggleFor] = useState<Booking | null>(null);

  const todayDate = startOfDay(new Date());
  const todayISO = format(todayDate, 'yyyy-MM-dd');

  // Raccourcis
  const goCheckIn = () => navigate('/care/checklists?moment=arrival');
  const goCheckOut = () => navigate('/care/checklists?moment=departure');
  const goInventory = () => navigate('/care/Inventory');

  // Charge “maison” 30 jours
// Charge “maison” 30 jours — version robuste sans jointure implicite
useEffect(() => {
  let cancelled = false;
  (async () => {
    setLoadingHouse(true);
    try {
      const maxDate = endOfDay(addDays(todayDate, 30));

      // 1) Bookings seuls (sans jointure)
      const { data: bookings, error: e1 } = await supabase
        .from('bookings')
        .select('*')
        .or(
          `and(start_date.gte.${format(todayDate,'yyyy-MM-dd')},start_date.lte.${format(maxDate,'yyyy-MM-dd')}),` +
          `and(end_date.gte.${format(todayDate,'yyyy-MM-dd')},end_date.lte.${format(maxDate,'yyyy-MM-dd')}),` +
          `and(start_date.lte.${format(todayDate,'yyyy-MM-dd')},end_date.gte.${format(todayDate,'yyyy-MM-dd')})`
        );

      if (e1) throw e1;

      const raw = (bookings ?? []).filter((b: Booking) => b.status !== 'cancelled');

      // 2) Récupère les profils nécessaires (unique user_ids)
      const userIds = Array.from(new Set(raw.map(b => b.user_id).filter(Boolean)));
      let profilesById: Record<string, { id: string; full_name?: string | null; avatar_url?: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profs, error: e2 } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        // Si RLS/permissions bloquent "profiles", on n'échoue pas : on garde les bookings et on affichera "Séjour"
        if (!e2 && Array.isArray(profs)) {
          profilesById = Object.fromEntries(profs.map(p => [p.id, p]));
        }
      }

      // 3) Recompose un champ "profiles" compatible avec le rendu existant
      const withProfiles = raw.map(b => ({
        ...b,
        profiles: profilesById[b.user_id as string] ?? null,
      }));

      if (!cancelled) setHouseBookings(withProfiles);
    } catch (e) {
      console.warn('[Dashboard] house bookings error:', e);
      if (!cancelled) {
        setHouseBookings([]);
        // on garde le toast d’avertissement
        enqueueSnackbar("Impossible de charger les séjours de la maison", { variant: 'warning' });
      }
    } finally {
      if (!cancelled) setLoadingHouse(false);
    }
  })();
  return () => { cancelled = true; };
}, [enqueueSnackbar]);


  // Charge inventaire : tous les produits épuisés (stock <= 0)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingInv(true);
      try {
        // 1) Dernier snapshot
        const { data: snap, error: e1 } = await supabase
          .from('inventory_snapshots')
          .select('id, items')
          .order('saved_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (e1) throw e1;

        const zeroLevelIds = new Set(
          (snap?.items ?? [])
            .filter((it: any) => it?.level === 0 && it?.product_id)
            .map((it: any) => it.product_id as string)
        );

        if (zeroLevelIds.size === 0) {
          if (!cancelled) setOutOfStock([]);
          return;
        }

        // 2) Détails des produits correspondants
        const { data: prods, error: e2 } = await supabase
          .from('inventory_products')
          .select('id,name,unit,is_active,sort_order')
          .in('id', Array.from(zeroLevelIds));
        if (e2) throw e2;

        if (!cancelled) {
          setOutOfStock((prods ?? []).map(p => ({
            id: p.id,
            name: p.name,
            stock: 0,
            min_threshold: null,
          })));
        }
      } catch (e) {
        console.warn('[Dashboard] inventory snapshot error:', e);
        if (!cancelled) setOutOfStock([]);
      } finally {
        if (!cancelled) setLoadingInv(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // --- Occupants ce soir : somme des personnes dont la nuit inclut today ---
  const tonightOccupants = useMemo(() => {
    const scope = (houseBookings.length ? houseBookings : myBookings) as Booking[];
    let total = 0;
    scope.forEach(b => {
      const persons = asArray(b.persons_details);
      persons.forEach(p => {
        const nights = getUniqueNightList(p.arrivalDate, p.departureDate);
        const hasTonight = Array.isArray(nights) ? nights.includes(todayISO) : nights.has(todayISO);
        if (hasTonight) total += 1;
      });
    });
    return total;
  }, [houseBookings, myBookings, todayISO]);

  // --- Mouvements du jour (personnes) ---
  const movements = useMemo(() => {
    const scope = (houseBookings.length ? houseBookings : myBookings) as Booking[];
    type PersonMove = {
      name: string;
      booking: Booking;
      owner: string;
      arrivalDate: string;
      departureDate: string;
      arrivalTime?: string;
      departureTime?: string;
    };

    const arrivals: PersonMove[] = [];
    const departures: PersonMove[] = [];
    
    scope.forEach(b => {
      const people = asArray(b.persons_details);
      const owner = b.profiles?.full_name || '';
      people.forEach(p => {
        if (isSameISO(p.arrivalDate, todayISO)) 
          arrivals.push({
          name: p.name || 'Participant',
          booking: b,
          owner,
          arrivalDate: p.arrivalDate,
          departureDate: p.departureDate,
          arrivalTime: p.arrivalTime,
          departureTime: p.departureTime,
        });

        if (isSameISO(p.departureDate, todayISO)) 
          departures.push({
            name: p.name || 'Participant',
            booking: b,
            owner,
            arrivalDate: p.arrivalDate,
            departureDate: p.departureDate,
            arrivalTime: p.arrivalTime,
            departureTime: p.departureTime,
          });
      });
    });
    return { arrivals, departures };
  }, [houseBookings, myBookings, todayISO]);

  // --- Mes séjours non payés (fini & status !== paid) ---
  const myUnpaid = useMemo(() => {
    const now = new Date();
    return (myBookings ?? [])
      .filter(b => b.status !== 'cancelled')
      .filter(b => isBefore(parseISO(b.end_date), now))
      .filter(b => b.status !== 'paid');
  }, [myBookings]);

  // --- Mes prochains séjours (30 jours) ---
  const myNext30 = useMemo(() => {
    const start = todayDate;
    const end = addDays(todayDate, 30);
    return (myBookings ?? [])
      .filter(b => isAfter(parseISO(b.start_date), start) && isBefore(parseISO(b.start_date), end))
      .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime());
  }, [myBookings, todayDate]);

  // --- La maison – Prochains séjours (autres utilisateurs seulement) ---
  const houseNextOthersSorted = useMemo(() => {
    const end = addDays(todayDate, 30);
    return (houseBookings ?? [])
      .filter(b => b.user_id !== user?.id)
      .filter(b => !(parseISO(b.end_date) <= todayDate || parseISO(b.start_date) >= end))
      .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime());
  }, [houseBookings, user?.id, todayDate]);

  const houseNextOthers5 = useMemo(() => houseNextOthersSorted.slice(0, 5), [houseNextOthersSorted]);
  const houseNextOthers10 = useMemo(() => houseNextOthersSorted.slice(0, 10), [houseNextOthersSorted]);

  // --- Actions ---
  const markPaid = useCallback((b: Booking) => {
    if (b.status === 'cancelled') return;
    const newStatus: SejourStatus = 'paid';
    updateStatus.mutate(
      { id: b.id, status: newStatus },
      { onSuccess: () => enqueueSnackbar('Séjour marqué comme payé', { variant: 'success' }) }
    );
  }, [enqueueSnackbar, updateStatus]);

  const handleStatusToggle = useCallback((booking: Booking) => {
    if (booking.status === 'cancelled') return;
    setToggleFor(booking);
  }, []);

  const handleCancel = useCallback((booking: Booking) => {
    if (booking.status === 'cancelled') return;
    setCancelFor(booking);
  }, []);

  const confirmCancel = useCallback(() => {
    if (!cancelFor) return;
    updateStatus.mutate(
      { id: cancelFor.id, status: 'cancelled' },
      { onSuccess: () => enqueueSnackbar('Séjour annulé', { variant: 'success' }) }
    );
    setCancelFor(null);
  }, [cancelFor, enqueueSnackbar, updateStatus]);


  const renderRichBookingCard = (b: Booking) => {
    const start = parseISO(b.start_date);
    const end = parseISO(b.end_date);
    const persons = asArray(b.persons_details);
    const namedPersons = persons.filter((p: any) => p.name !== 'Adulte' && p.name !== 'Enfant');
    const genericAdults = persons.filter((p: any) => p.name === 'Adulte').length;
    const genericChildren = persons.filter((p: any) => p.name === 'Enfant').length;
    const hasDiscount = (b.discount_rate ?? 0) > 0;

    return (
      <Card key={b.id} variant="outlined" sx={{ borderColor: '#1976d2' }}>
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" fontWeight={600}>
                {b.profiles?.full_name || 'Nom non renseigné'}
              </Typography>
              <Chip label={b.status === 'paid' ? 'Payé' : (b.status === 'pending' ? 'À payer' : b.status)} color={b.status === 'paid' ? 'success' : 'warning'} size="small" />
              {b.status === 'paid' && hasDiscount && (
                <Chip size="small" color="warning" label={`Ristourne ${Math.round((b.discount_rate ?? 0) * 100)}%`} />
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
              {namedPersons.map((p: any, idx: number) => (
                <Chip key={`${p.name}-${idx}`} label={p.name} size="small" sx={{ mb: 0.5 }} />
              ))}
              {genericAdults > 0 && <Chip label={`${genericAdults} adulte${genericAdults > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />}
              {genericChildren > 0 && <Chip label={`${genericChildren} enfant${genericChildren > 1 ? 's' : ''}`} size="small" sx={{ mb: 0.5 }} />}
            </Stack>

            {b.status !== 'cancelled' && (
              <Stack direction="row" spacing={1} alignItems="center">
                <MonetizationOn fontSize="small" />
                <Typography variant="body2">Coût total : {b.total_cost || 0} €</Typography>
              </Stack>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" flexWrap="wrap">
              {b.status !== 'cancelled' && b.status !== 'paid' && (
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  onClick={() => handleStatusToggle(b)}
                  sx={{ textTransform: 'none' }}
                >
                  Marquer comme payé
                </Button>
              )}

              <Button
                variant="outlined"
                size="small"
                startIcon={<InfoOutlined />}
                onClick={() => setPriceDialogFor(b)}
                sx={{ textTransform: 'none' }}
              >
                Comprendre le prix
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<Checklist />}
                onClick={() => setEditFor(b)}
                disabled={b.status === 'cancelled' || b.status === 'paid'}
                sx={{ textTransform: 'none', ml: { xs: 0, sm: 'auto' } }}
              >
                Modifier
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  };

// +++ AJOUTER — mêmes blocs que dans AllBookingsPage, en version "mes séjours"
const renderHeaderFull = (b: Booking) => (
  <Stack direction="row" spacing={1} alignItems="center">
    <Typography variant="subtitle1" fontWeight={600}>
      {b.profiles?.full_name || 'Nom non renseigné'}
    </Typography>
    <Chip label={getStatusLabel(b.status)} color={getChipColor(b.status)} size="small" />
    {b.status !== 'cancelled' && (b.discount_rate ?? 0) > 0 && (
      <Chip size="small" color="warning" label={`Remise ${Math.round((b.discount_rate ?? 0) * 100)}%`} />
    )}
  </Stack>
);

const renderBodyFull = (b: Booking) => {
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

      {b.status !== 'cancelled' && (
        <Stack direction="row" spacing={1} alignItems="center">
          <MonetizationOn fontSize="small" />
          <Typography variant="body2">Coût total : {b.total_cost || 0} €</Typography>
        </Stack>
      )}
    </Stack>
  );
};

const renderActionsFull = (b: Booking) => (
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
      onClick={() => setEditFor(b)}
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


  return (
    <Box
        p={2}
        sx={{
          maxWidth: '100vw',
          overflowX: 'hidden',
          // démarre sous le header principal
          pt: 'calc(var(--imet-header-offset, 64px) + 8px)',
          // safe-area bas
          pb: { xs: 'calc(16px + env(safe-area-inset-bottom))', sm: 2 },
        }}
      >
      {/* ===== Bandeau Aujourd’hui — version optimisée ===== */}
      <Card
        sx={{
          
          top: 'calc(var(--imet-header-offset, 64px) + 8px)',
          zIndex: 10,
          mb: 2,
          height: { xs: 'auto', md: 'fit-content' },
          maxHeight: { xs: '100vh', md: 'none' },
        }}
        elevation={2}
      >
        <CardContent sx={{ py: 1.5, overflowX: { xs: 'auto', md: 'visible' } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            sx={{
              width: '100%',
              minWidth: { xs: '100%', md: 0 },
              '& > *': { flexShrink: 0 },
            }}
          >
            <Typography variant="h6" sx={{ mr: { md: 1 } }}>
              Aujourd’hui
            </Typography>

            {!isMobile && (
              <Divider flexItem orientation="vertical" sx={{ mx: 1.5 }} />
            )}
            {isMobile && <Divider sx={{ my: 1.5 }} />}

            {/* Occupants ce soir */}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ minWidth: 0 }}>
              <Typography variant="body2">Ce soir :</Typography>
              <Chip
                color={tonightOccupants >= 15 ? 'error' : 'success'}
                label={`${tonightOccupants}`}
                size="small"
              />
              <Button
                size="small"
                onClick={() => navigate('/bookings')}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                endIcon={<ArrowForwardIos fontSize="inherit" />}
              >
                Détails
              </Button>
            </Stack>

            {!isMobile && (
              <Divider flexItem orientation="vertical" sx={{ mx: 1.5 }} />
            )}
            {isMobile && <Divider sx={{ my: 1.5 }} />}

            {/* Mouvements du jour */}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ minWidth: 0 }}>
              <Typography variant="body2">Aujourd'hui :</Typography>
              <Chip size="small" icon={<Login />} label={`${movements.arrivals.length}`} sx={{ height: 24 }} />
              <Chip size="small" icon={<Logout />} label={`${movements.departures.length}`} sx={{ height: 24 }} />
              <Button
                size="small"
                onClick={() => setMovementsOpen(true)}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 'fit-content' }}
                endIcon={<ArrowForwardIos fontSize="inherit" />}
              >
                {isMobile ? 'Détails' : 'Voir détails'}
              </Button>
            </Stack>

            {!isMobile && (
              <Divider flexItem orientation="vertical" sx={{ mx: 1.5 }} />
            )}
            {isMobile && <Divider sx={{ my: 1.5 }} />}

            {/* Raccourcis — empêche le chevauchement des boutons */}
            {/* Raccourcis — 4 boutons fixes */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{
                width: '100%',
                '& > *': {
                  flex: { xs: '1 1 100%', sm: '0 0 auto' },
                },
              }}
            >
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setShowWizard(true)}
                sx={{ textTransform: 'none' }}
              >
                Créer un séjour
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<Login />}
                onClick={goCheckIn}
                sx={{ textTransform: 'none' }}
              >
                Check-in
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<Logout />}
                onClick={goCheckOut}
                sx={{ textTransform: 'none' }}
              >
                Check-out
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<Inventory2 />}
                onClick={goInventory}
                sx={{ textTransform: 'none' }}
              >
                Inventaire
              </Button>
            </Stack>

          </Stack>
        </CardContent>
      </Card>

      {/* ===== Deux colonnes SANS GRID ===== */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems="flex-start"
      >
        {/* Colonne gauche — Mon côté */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Mes séjours non payés : cartes riches */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="h6">Mes séjours non payés</Typography>
                <Button
                  size="small"
                  onClick={() => navigate('/bookings/all')}
                  endIcon={<ArrowForwardIos fontSize="inherit" />}
                >
                  Voir plus
                </Button>
              </Stack>
              {!myUnpaid.length ? (
                <Typography variant="body2" color="text.secondary">Aucun séjour à régler 👍</Typography>
              ) : (
                <Stack spacing={1.25}>
                  {myUnpaid.map(renderRichBookingCard)}
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* Mes prochains séjours (30 j) */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="h6">Mes prochains séjours (30 j)</Typography>
                <Button
                  size="small"
                  onClick={() => setOpenMyUpcoming(true)}
                  endIcon={<ArrowForwardIos fontSize="inherit" />}
                >
                  Voir plus
                </Button>
              </Stack>

              {!myNext30.length ? (
                <Typography variant="body2" color="text.secondary">Rien de prévu pour l’instant.</Typography>
              ) : (
                <Stack spacing={1.25}>
                  {myNext30.map(b => (
                    <Card
                      key={b.id}
                      variant="outlined"
                      sx={{
                        borderColor: '#1976d2',
                        opacity: b.status === 'cancelled' ? 0.6 : 1,
                        filter: b.status === 'cancelled' ? 'grayscale(0.3)' : 'none',
                      }}
                    >
                      <CardContent>
                        <Stack spacing={1}>
                          {renderHeaderFull(b)}
                          {renderBodyFull(b)}
                          {renderActionsFull(b)}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Colonne droite — La maison */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Prochains séjours (autres utilisateurs uniquement) */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="h6">Prochains séjours (autres)</Typography>
                <Button
                  size="small"
                  onClick={() => setOpenHouseUpcoming(true)}
                  endIcon={<ArrowForwardIos fontSize="inherit" />}
                >
                  Voir plus
                </Button>
              </Stack>

              {loadingHouse ? (
                <Stack spacing={1}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} variant="rounded" height={56} />
                  ))}
                </Stack>
              ) : !houseNextOthers5.length ? (
                <Typography variant="body2" color="text.secondary">Aucun séjour d’autres utilisateurs dans les 30 prochains jours.</Typography>
              ) : (
                <Stack spacing={1}>
                  {houseNextOthers5.map(b => (
                    <MiniBookingCard key={b.id} b={b} showMaxBadge />
                  ))}
                </Stack>
              )}

            </CardContent>
          </Card>

          {/* Inventaire — Épuisés (mise en avant) */}
          <Card sx={{ borderColor: 'error.main', boxShadow: 3, outline: '2px solid', outlineColor: 'rgba(211,47,47,0.2)' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Inventory2 color="error" />
                  <Typography variant="h6" color="error.main">Inventaire — ÉPUISÉS</Typography>
                </Stack>
                <Button size="small" onClick={goInventory} endIcon={<ArrowForwardIos fontSize="inherit" />}>
                  Voir plus
                </Button>
              </Stack>

              {loadingInv ? (
                <Stack spacing={1}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} variant="rounded" height={48} />
                  ))}
                </Stack>
              ) : !outOfStock.length ? (
                <Typography variant="body2" color="text.secondary">Aucun article épuisé 🎉</Typography>
              ) : (
                <Stack spacing={1}>
                  {outOfStock.map(item => (
                    <Card key={item.id} variant="outlined" sx={{ p: 0.5, borderColor: 'error.main', background: 'rgba(211,47,47,0.06)' }}>
                      <CardContent sx={{ py: 1.0, '&:last-child': { pb: 1.0 } }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2">{item.name}</Typography>
                          <Chip size="small" color="error" label="Épuisé" />
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Box>
      </Stack>

      {/* Floating + */}
      <Tooltip title="Nouveau séjour">
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            // safe-area iOS
            bottom: { xs: 'calc(24px + env(safe-area-inset-bottom))', sm: 24 },
            right: 24,
            zIndex: (t) => t.zIndex.fab,
          }}
          onClick={() => setShowWizard(true)}
        >
          <AddIcon />
        </Fab>
      </Tooltip>

      {/* Modales */}
      {priceDialogFor && <PriceDetailsDialog booking={priceDialogFor} onClose={() => setPriceDialogFor(null)} fullScreen={isMobile} />}

      {editFor && (
        <EditBookingDialog
          open
          booking={editFor}
          onClose={() => setEditFor(null)}
        />
      )}

      <MovementsDialog
        open={movementsOpen}
        onClose={() => setMovementsOpen(false)}
        arrivals={movements.arrivals}
        departures={movements.departures}
        dateISO={todayISO}
        fullScreen={isMobile}
      />

      {/* Pop-ups “Voir plus” */}
      <UpcomingDialog
        open={openMyUpcoming}
        onClose={() => setOpenMyUpcoming(false)}
        title="Mes 10 prochains séjours"
        bookings={myNext30}
        onSeeAll={() => navigate('/bookings/all')}
        fullScreen={isMobile}
      />

      <UpcomingDialog
        open={openHouseUpcoming}
        onClose={() => setOpenHouseUpcoming(false)}
        title="La maison — 10 prochains séjours (autres)"
        bookings={houseNextOthers10}
        onSeeAll={() => navigate('/bookings/all')}
        fullScreen={isMobile}
      />

      {/* Confirmation de changement de statut */}
      <ConfirmDialog
        open={!!toggleFor}
        title={toggleFor?.status === 'paid'
          ? 'Marquer le séjour comme NON payé'
          : 'Marquer le séjour comme payé'}
        message={toggleFor
          ? `Confirmez-vous le changement de statut du séjour de ${format(parseISO(toggleFor.start_date),'dd/MM/yyyy')} au ${format(parseISO(toggleFor.end_date),'dd/MM/yyyy')} ?`
          : ''}
        confirmLabel={toggleFor?.status === 'paid' ? 'Marquer non payé' : 'Marquer payé'}
        onCancel={() => setToggleFor(null)}
        onConfirm={() => {
          if (!toggleFor) return;
          const newStatus: SejourStatus = toggleFor.status === 'paid' ? 'pending' : 'paid';
          updateStatus.mutate(
            { id: toggleFor.id, status: newStatus },
            {
              onSuccess: () => {
                enqueueSnackbar(
                  newStatus === 'paid' ? 'Séjour marqué comme payé' : 'Séjour marqué comme non payé',
                  { variant: 'success' }
                );
                setToggleFor(null);
              },
              onError: () => setToggleFor(null),
            }
          );
        }}
      />

      {/* Confirmation d'annulation */}
      <ConfirmDialog
        open={!!cancelFor}
        title="Annuler le séjour"
        message={
          cancelFor
            ? `Confirmez-vous l'annulation de votre séjour du ${format(parseISO(cancelFor.start_date),'dd/MM/yyyy')} au ${format(parseISO(cancelFor.end_date),'dd/MM/yyyy')} ?`
            : ''
        }
        confirmLabel="Annuler le séjour"
        onCancel={() => setCancelFor(null)}
        onConfirm={confirmCancel}
      />


      <BookingWizard open={showWizard} onClose={() => setShowWizard(false)} />
    </Box>
  );
};
