// src/components/EditBookingDialog.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Select,
  Button, IconButton, TextField, MenuItem, Stack, Typography, Box
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { useSnackbar } from 'notistack';
import { format, isBefore, isSameDay } from 'date-fns';

import { useAuth } from '../hooks/useAuth';
import { useFamily } from '../hooks/useFamily';
import { useBookings, useAdminBookings } from '../hooks/useBookings';
import { useUpdateBooking } from '../hooks/useUpdateBooking';

import { hasOverlappingBooking, calculateBookingCost } from '../utils/bookingUtils';
import { isAdult } from '../utils/ageUtils';

import type {
  Booking,
  PersonDetails,
  ArrivalTime,
  DepartureTime,
  UpdateBookingData,
  PersonDetailsForServer
} from '../types/booking';

type FamilySelectItem = { id: string; name: string; birth_date: string | null };

type DialogScope =
  | { type: 'user'; userId: string }
  | { type: 'admin' };

interface EditBookingDialogProps {
  open: boolean;
  onClose: () => void;
  booking: Booking;
  /** Par défaut: scope user avec l'utilisateur courant */
  scope?: DialogScope;
  prefetchedFamily?: Array<{ id: string; full_name: string; birth_date?: string | null }>;
}

const timeOptions: ArrivalTime[] = ['morning', 'afternoon', 'evening'];
const timeLabels: Record<ArrivalTime | DepartureTime, string> = {
  morning: 'Avant déjeuner',
  afternoon: 'Avant diner',
  evening: 'Après diner',
};
const safeName = (n?: string | null) => (n && n.trim() ? n : 'Sans nom');

export const EditBookingDialog: React.FC<EditBookingDialogProps> = ({
  open,
  onClose,
  booking,
  scope,
  prefetchedFamily,
}) => {

  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const isAdmin = scope?.type === 'admin';
  const effectiveUserId = useMemo(() => {
    if (scope?.type === 'user') return scope.userId;
    if (isAdmin) return booking.user_id;
    return user?.id ?? booking.user_id;
  }, [scope, isAdmin, user?.id, booking.user_id]);

  // Famille du "propriétaire" de la réservation
   const { closeFamily } = useFamily(effectiveUserId || '');

 // Normalise en une liste homogène pour l'UI
   const familySelectList = useMemo<FamilySelectItem[]>(() => {
    const source = (prefetchedFamily && prefetchedFamily.length ? prefetchedFamily : closeFamily) ?? [];
     return source.map((f: any) => ({
       id: f.id,
       name: safeName(f.full_name),
       birth_date: f.birth_date ?? null, // <-- null au lieu d'undefined
     }));
   }, [prefetchedFamily, closeFamily]);

    // L'utilisateur "propriétaire" du séjour (pour l'admin, on veut le voir dans la liste)
  const ownerSelect = useMemo(() => {
    return {
      id: booking.user_id,
      name: booking.profiles?.full_name ?? 'Utilisateur',
      birth_date: null as string | null,
    };
  }, [booking.user_id, booking.profiles?.full_name]);

    // Pool unique : owner (si admin) + famille
  const selectablePool = useMemo<FamilySelectItem[]>(() => {
    return scope?.type === 'admin'
      ? [ownerSelect, ...familySelectList]
      : familySelectList;
  }, [scope?.type, ownerSelect, familySelectList]);

  // Réservations pour la détection de conflits (même utilisateur)
  const { data: userBookings = [] } = useBookings(!isAdmin ? effectiveUserId : undefined);
  const { data: allAdminBookings = [] } = useAdminBookings();
  const bookingsOfUser = useMemo(
    () => (isAdmin ? allAdminBookings.filter(b => b.user_id === booking.user_id) : userBookings),
    [isAdmin, allAdminBookings, userBookings, booking.user_id]
  );

  // Hook d’update scopé
  const updateBooking = useUpdateBooking(
    isAdmin ? { scope: 'admin' } : { scope: 'user', userId: effectiveUserId! }
  );

  const [personDetails, setPersonDetails] = useState<PersonDetails[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Conflit → confirmation
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateBookingData | null>(null);

  // Options adultes = pool filtrée par "majeur"
  const getAdultOptions = useMemo(() => {
    const base: { id: string; name: string }[] = [];
    // côté user : on peut préfixer par l'utilisateur courant si utile
    if (!isAdmin && user?.id) base.push({ id: user.id, name: safeName(user.full_name) });
    return [
      ...base,
      ...selectablePool
        .filter((f) => isAdult(f.birth_date ?? undefined))
        .map((f) => ({ id: f.id, name: f.name })),
      { id: 'adulte_famille', name: 'Adulte' }, // générique
    ];
  }, [isAdmin, user?.id, selectablePool]);

  // Options enfants = pool filtrée par "mineur"
  const getChildOptions = useMemo(() => {
    const base: { id: string; name: string }[] = [];
    if (!isAdmin && user?.id) base.push({ id: user.id, name: safeName(user.full_name) });

    return [
      ...base,
      ...selectablePool
        .filter((f) => !isAdult(f.birth_date ?? undefined))
        .map((f) => ({ id: f.id, name: f.name })),
      { id: 'enfant_famille', name: 'Enfant' }, // générique
    ];
  }, [isAdmin, user?.id, selectablePool]);

  // Sert juste à éviter le "flash" (valeur non trouvée) quand le type adulte/enfant bascule
  const allOptions = useMemo(
    () => [...getAdultOptions, ...getChildOptions],
    [getAdultOptions, getChildOptions]
  );

  useEffect(() => {
    if (open && booking) {
      setPersonDetails(
        (booking.persons_details || []).map((p) => {
          const nameStr = String(p.name || '');
          const fallbackType = nameStr.toLowerCase().includes('enfant') ? 'enfant_amis' : 'adulte_amis';
          return {
            ...p,
            arrivalDate: p.arrivalDate ? new Date(p.arrivalDate) : (booking.start_date ? new Date(booking.start_date) : null),
            departureDate: p.departureDate ? new Date(p.departureDate) : (booking.end_date ? new Date(booking.end_date) : null),
            person_type: p.person_type ?? fallbackType,
          };
        })
      );
      // user: en lecture seule si payé; admin: toujours modifiable
      setIsReadOnly(!isAdmin && booking.status === 'paid');
      setShowConflictDialog(false);
      setPendingUpdate(null);
    }
  }, [open, booking, isAdmin]);

  const handleChangePerson = (index: number, field: keyof PersonDetails, value: any) => {
    const updated = [...personDetails];
    (updated[index] as any)[field] = value;
    setPersonDetails(updated);
  };

  const handleRemovePerson = (index: number) => {
    const updated = [...personDetails];
    updated.splice(index, 1);
    setPersonDetails(updated);
  };

  const handleAddAdult = () => {
    setPersonDetails((prev) => [
      ...prev,
      {
        name: 'Adulte',
        arrivalDate: booking.start_date ? new Date(booking.start_date) : null,
        arrivalTime: booking.arrival_time,
        departureDate: booking.end_date ? new Date(booking.end_date) : null,
        departureTime: booking.departure_time,
        person_type: 'adulte_amis',
      },
    ]);
  };

  const handleAddChild = () => {
    setPersonDetails((prev) => [
      ...prev,
      {
        name: 'Enfant',
        arrivalDate: booking.start_date ? new Date(booking.start_date) : null,
        arrivalTime: booking.arrival_time,
        departureDate: booking.end_date ? new Date(booking.end_date) : null,
        departureTime: booking.departure_time,
        person_type: 'enfant_amis',
      },
    ]);
  };

  // Rang pour comparer les heures d'arrivée/départ
  const timeRank = { morning: 1, afternoon: 2, evening: 3 } as const;

  type PD = PersonDetails & { arrivalDate: Date; departureDate: Date };

  const computeBookingBounds = (persons: PersonDetails[]) => {
    const valid = persons.filter(p => p.arrivalDate && p.departureDate) as PD[];
    if (valid.length === 0) return null;

    // Dates min/max
    let minDate = valid[0].arrivalDate;
    let maxDate = valid[0].departureDate;
    for (const p of valid) {
      if (p.arrivalDate < minDate) minDate = p.arrivalDate;
      if (p.departureDate > maxDate) maxDate = p.departureDate;
    }

    // Heure d'arrivée = la plus "tôt" parmi ceux qui arrivent le jour minDate
    const earliest = valid.filter(p => isSameDay(p.arrivalDate, minDate));
    let arrivalTime = earliest[0].arrivalTime;
    for (const p of earliest) {
      if (timeRank[p.arrivalTime] < timeRank[arrivalTime]) arrivalTime = p.arrivalTime;
    }

    // Heure de départ = la plus "tard" parmi ceux qui partent le jour maxDate
    const latest = valid.filter(p => isSameDay(p.departureDate, maxDate));
    let departureTime = latest[0].departureTime;
    for (const p of latest) {
      if (timeRank[p.departureTime] > timeRank[departureTime]) departureTime = p.departureTime;
    }

    return {
      start_date: format(minDate, 'yyyy-MM-dd'),
      end_date: format(maxDate, 'yyyy-MM-dd'),
      arrival_time: arrivalTime,
      departure_time: departureTime,
    };
  };


  // Utilise des dates formatées pour compatibilité avec calculateBookingCost (qui parse des strings)
  const buildSanitizedPersons = (): PersonDetailsForServer[] => {
    return personDetails.map(p => ({
      ...p,
      arrivalDate: p.arrivalDate ? format(p.arrivalDate as Date, 'yyyy-MM-dd') : null,
      departureDate: p.departureDate ? format(p.departureDate as Date, 'yyyy-MM-dd') : null,
    }));
  };

  const buildUpdatePayload = async (): Promise<UpdateBookingData> => {
    const sanitized = buildSanitizedPersons();
    const baseTotal = await calculateBookingCost(personDetails);
    const adults = personDetails.filter((p) => (p.person_type || '').startsWith('adulte')).length;
    const children = personDetails.filter((p) => (p.person_type || '').startsWith('enfant')).length;
    const bounds = computeBookingBounds(personDetails);
    const rate = booking.discount_rate ?? 0; 
    const net = Math.round(baseTotal * (1 - rate));

    const payload: UpdateBookingData = {
      persons_details: sanitized,
      base_total_cost: baseTotal,
      discount_rate: rate,
      total_cost: net,
      adults,
      children,
    };

    // Si les personnes étendent/réduisent la période, on ajuste le séjour
    if (bounds) {
     if (
        bounds.start_date !== booking.start_date ||
        bounds.end_date !== booking.end_date ||
        bounds.arrival_time !== booking.arrival_time ||
        bounds.departure_time !== booking.departure_time
      ) {
        (payload as any).start_date = bounds.start_date;
        (payload as any).end_date = bounds.end_date;
        (payload as any).arrival_time = bounds.arrival_time;
        (payload as any).departure_time = bounds.departure_time;
     }
   }
  return payload;
  };

  const handleSave = async () => {
    // validations de base
    for (const person of personDetails) {
      if (!person.arrivalDate || !person.departureDate) {
        enqueueSnackbar(`Le participant ${person.name} n'a pas de dates complètes.`, { variant: 'error' });
        return;
      }
      if (isBefore(person.departureDate as Date, person.arrivalDate as Date)) {
        enqueueSnackbar(`Le départ est avant l'arrivée pour ${person.name}.`, { variant: 'error' });
        return;
      }
    }

    // Conflit à l’échelle du même utilisateur
    const overlapping = hasOverlappingBooking(
      new Date((computeBookingBounds(personDetails)?.start_date ?? booking.start_date)),
      new Date((computeBookingBounds(personDetails)?.end_date   ?? booking.end_date)),
      booking.user_id,
      bookingsOfUser,
      booking.id,
      (computeBookingBounds(personDetails)?.arrival_time ?? booking.arrival_time),
      (computeBookingBounds(personDetails)?.departure_time ?? booking.departure_time)
    );

    try {
      const payload = await buildUpdatePayload();

      if (overlapping) {
        // UX BookingWizard : proposer de forcer
        setPendingUpdate(payload);
        setShowConflictDialog(true);
        return;
      }

      // Pas de conflit → update direct
      updateBooking.mutate(
        { id: booking.id, data: payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Séjour mis à jour avec succès.', { variant: 'success' });
            onClose();
          },
          onError: (err) => {
            enqueueSnackbar(err.message, { variant: 'error' });
          },
        }
      );
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Erreur lors du calcul du coût.', { variant: 'error' });
    }
  };

  const confirmSaveDespiteConflict = () => {
    if (!pendingUpdate) {
      setShowConflictDialog(false);
      return;
    }
    updateBooking.mutate(
      { id: booking.id, data: pendingUpdate },
      {
        onSuccess: () => {
          enqueueSnackbar('Séjour mis à jour malgré le conflit.', { variant: 'success' });
          setShowConflictDialog(false);
          setPendingUpdate(null);
          onClose();
        },
        onError: (err) => {
          enqueueSnackbar(err.message, { variant: 'error' });
          setShowConflictDialog(false);
          setPendingUpdate(null);
        },
      }
    );
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>Modifier les participants</DialogTitle>
        <DialogContent>
          <Stack spacing={3} mt={1}>
            {personDetails.map((person, index) => {
              const isAdultType = (person.person_type || '').startsWith('adulte');
              const options = isAdultType ? getAdultOptions : getChildOptions;
              const isValueValid = allOptions.some((opt) => opt.name === person.name);

              return (
                <Box
                  key={index}
                  sx={{
                    border: '1px solid #ddd',
                    borderRadius: 2,
                    p: 2,
                    boxShadow: 1,
                    backgroundColor: '#fafafa',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight="bold">Participant {index + 1}</Typography>
                    {!isReadOnly && (
                      <IconButton onClick={() => handleRemovePerson(index)}>
                        <CloseIcon />
                      </IconButton>
                    )}
                  </Stack>

                  {/* Ligne 1 : nom, arrivée (date/heure) */}
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mt={2} alignItems="flex-start">
                    <Box sx={{ flex: 1, minWidth: 180 }}>
                      <Select
                        fullWidth
                        label="Nom"
                        value={isValueValid ? person.name : ''}
                        onChange={(e) => {
                          const updated = [...personDetails];
                          const selectedName = e.target.value as string;
                          updated[index].name = selectedName;

                          const matchingFamily = selectablePool.find((f) => f.name === selectedName);
                          if (matchingFamily) {
                            updated[index].person_type = isAdult(matchingFamily.birth_date ?? undefined)
                              ? 'adulte_famille'
                              : 'enfant_famille';
                          } else {
                            updated[index].person_type = isAdultType ? 'adulte_amis' : 'enfant_amis';
                          }

                          setPersonDetails(updated);
                        }}
                      >
                        {options.map((option) => (
                          <MenuItem key={option.id} value={option.name}>
                            {option.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 160 }}>
                      <DatePicker
                        label="Date d'arrivée"
                        value={person.arrivalDate as Date | null}
                        onChange={(d) => handleChangePerson(index, 'arrivalDate', d)}
                        disabled={isReadOnly}
                      />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 140 }}>
                      <TextField
                        select
                        label="Heure d'arrivée"
                        value={person.arrivalTime}
                        onChange={(e) => handleChangePerson(index, 'arrivalTime', e.target.value)}
                        disabled={isReadOnly}
                        fullWidth
                      >
                        {timeOptions.map((t) => (
                          <MenuItem key={t} value={t}>
                            {timeLabels[t]}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                  </Stack>

                  {/* Ligne 2 : départ (date/heure) */}
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mt={2} alignItems="flex-start">
                    <Box sx={{ flex: 1, minWidth: 160 }}>
                      <DatePicker
                        label="Date de départ"
                        value={person.departureDate as Date | null}
                        onChange={(d) => handleChangePerson(index, 'departureDate', d)}
                        disabled={isReadOnly}
                      />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 140 }}>
                      <TextField
                        select
                        label="Heure de départ"
                        value={person.departureTime}
                        onChange={(e) => handleChangePerson(index, 'departureTime', e.target.value)}
                        disabled={isReadOnly}
                        fullWidth
                      >
                        {timeOptions.map((t) => (
                          <MenuItem key={t} value={t}>
                            {timeLabels[t]}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                  </Stack>
                </Box>
              );
            })}

            {!isReadOnly && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button startIcon={<AddIcon />} onClick={handleAddAdult} variant="outlined">
                  Ajouter un adulte
                </Button>
                <Button startIcon={<AddIcon />} onClick={handleAddChild} variant="outlined">
                  Ajouter un enfant
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Stack direction="row" spacing={2} justifyContent="flex-end" width="100%">
            <Button onClick={onClose} variant="outlined">
              Annuler
            </Button>
            {!isReadOnly && (
              <Button variant="contained" onClick={handleSave}>
                Enregistrer
              </Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>

      {/* Dialogue de confirmation en cas de conflit */}
      <Dialog open={showConflictDialog} onClose={() => setShowConflictDialog(false)}>
        <DialogTitle>Conflit possible de dates</DialogTitle>
        <DialogContent>
          <Typography>
            Il semble qu'une autre réservation existe pour cette période. Voulez-vous vraiment continuer ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowConflictDialog(false);
              setPendingUpdate(null);
            }}
          >
            Non
          </Button>
          <Button variant="contained" color="primary" onClick={confirmSaveDespiteConflict}>
            Oui
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
