import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Select,
  Button, IconButton, TextField, MenuItem, Stack, Typography, Box
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { useSnackbar } from 'notistack';
import { isBefore } from 'date-fns';

import { useAuth } from '../hooks/useAuth';
import { useFamily } from '../hooks/useFamily';
import { useBookings } from '../hooks/useBookings';
import { useUpdateBooking } from '../hooks/useUpdateBooking';

import { hasOverlappingBooking, calculateBookingCost } from '../utils/bookingUtils';
import { isAdult } from '../utils/ageUtils';

import type { Booking, PersonDetails, ArrivalTime, DepartureTime } from '../types/booking';

interface EditBookingDialogProps {
  open: boolean;
  onClose: () => void;
  booking: Booking;
}

const timeOptions: ArrivalTime[] = ['morning', 'afternoon', 'evening'];
const timeLabels = { morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir' };

export const EditBookingDialog: React.FC<EditBookingDialogProps> = ({ open, onClose, booking }) => {
  const { user } = useAuth();
  const { closeFamily } = useFamily(user?.id || '');
  const { data: allBookings = [] } = useBookings(user?.id ?? '');
  console.log("👤 Bookings du user :", allBookings.map(b => b.id));
  const updateBooking = useUpdateBooking();
  const { enqueueSnackbar } = useSnackbar();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  const queryClient = useQueryClient();

  const [personDetails, setPersonDetails] = useState<PersonDetails[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const getAdultOptions = () => {
    if (!user) return []; // ⛑ éviter toute erreur si user n'est pas encore chargé

    return [
      { id: user.id, name: user.full_name },
      ...closeFamily.filter(f => isAdult(f.birth_date)).map(f => ({
        id: f.id,
        name: f.full_name
      })),
      { id: 'adulte_generique', name: 'Adulte' }
    ];
  };

  const getChildOptions = () => {
  if (!user) return []; // ⛑ éviter toute erreur si user n'est pas encore chargé

  return [
    { id: user.id, name: user.full_name },
    ...closeFamily.filter(f => !isAdult(f.birth_date)).map(f => ({
      id: f.id,
      name: f.full_name
    })),
    { id: 'enfant_generique', name: 'Enfant' }
  ];
};

  useEffect(() => {
    if (open && booking) {
      setPersonDetails(
        (booking.persons_details || []).map(p => {
          const fallbackType = p.name.toLowerCase().includes('enfant')
            ? 'enfant_amis'
            : 'adulte_amis';
          
          return {
            ...p,
            arrivalDate: p.arrivalDate ? new Date(p.arrivalDate) : null,
            departureDate: p.departureDate ? new Date(p.departureDate) : null,
            person_type: p.person_type ?? fallbackType
          };
        })
      );
      setIsReadOnly(booking.status === 'paid');
    }
  }, [open, booking]);

  const handleChangePerson = (index: number, field: keyof PersonDetails, value: any) => {
    const updated = [...personDetails];
    updated[index][field] = value;
    setPersonDetails(updated);
  };

  const handleRemovePerson = (index: number) => {
    const updated = [...personDetails];
    updated.splice(index, 1);
    setPersonDetails(updated);
  };

  const handleAddAdult = () => {
    setPersonDetails([...personDetails, {
      name: 'Adulte',
      arrivalDate: booking.start_date ? new Date(booking.start_date) : null,
      arrivalTime: booking.arrival_time,
      departureDate: booking.end_date ? new Date(booking.end_date) : null,
      departureTime: booking.departure_time,
      person_type: 'adulte_amis'
    }]);
  };

  const handleAddChild = () => {
    setPersonDetails([...personDetails, {
      name: 'Enfant',
      arrivalDate: booking.start_date ? new Date(booking.start_date) : null,
      arrivalTime: booking.arrival_time,
      departureDate: booking.end_date ? new Date(booking.end_date) : null,
      departureTime: booking.departure_time,
      person_type: 'enfant_amis'
    }]);
  };

  const handleSave = async () => {
    for (const person of personDetails) {
      if (!person.arrivalDate || !person.departureDate) {
        enqueueSnackbar(`Le participant ${person.name} n'a pas de dates complètes.`, { variant: 'error' });
        return;
      }
      if (isBefore(person.departureDate, person.arrivalDate)) {
        enqueueSnackbar(`Le départ est avant l'arrivée pour ${person.name}.`, { variant: 'error' });
        return;
      }
    }

    console.log('📦 DEBUG booking.id        :', booking.id);
    console.log('📦 DEBUG booking.user_id  :', booking.user_id);
    console.log('📦 DEBUG user.id          :', user?.id);
    console.log('📅 DEBUG start date       :', booking.start_date);
    console.log('📅 DEBUG end date         :', booking.end_date);
    console.log('📚 DEBUG allBookings ids  :', allBookings.map(b => b.id));

    const overlapping = hasOverlappingBooking(
      new Date(booking.start_date),
      new Date(booking.end_date),
      booking.user_id,
      allBookings,
      booking.id,
      booking.arrival_time,
      booking.departure_time
    );

    if (overlapping) {
      enqueueSnackbar('Conflit : un autre séjour existe déjà à ces dates.', { variant: 'error' });
      return;
    }

    try {
      const totalCost = await calculateBookingCost(personDetails);
      const adults = personDetails.filter(p =>
        p.person_type?.startsWith('adulte')
      ).length;

      const children = personDetails.filter(p =>
        p.person_type?.startsWith('enfant')
      ).length;

      updateBooking.mutate({
        id: booking.id,
        data: {
          persons_details: personDetails,
          total_cost: totalCost,
          adults,
          children
        }
      }, {
        onSuccess: () => {
          enqueueSnackbar('Séjour mis à jour avec succès.', { variant: 'success' });
          queryClient.invalidateQueries({ queryKey: ['bookings', user?.id] });
          onClose();
        },
        onError: (err) => {
          enqueueSnackbar(err.message, { variant: 'error' });
        }
      });
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Erreur lors du calcul du coût.', { variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Modifier les participants</DialogTitle>
      <DialogContent>
        <Stack spacing={3} mt={1}>
          {personDetails.map((person, index) => {
            const options = (person.person_type || '').startsWith('adulte')
              ? getAdultOptions()
              : getChildOptions();

            const isValueValid = options.some(opt => opt.name === person.name);

            return (
              <Box
                key={index}
                sx={{
                  border: '1px solid #ddd',
                  borderRadius: 2,
                  p: 2,
                  boxShadow: 1,
                  backgroundColor: '#fafafa'
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
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  mt={2}
                  alignItems="flex-start"
                >
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    <Select
                      fullWidth
                      label="Nom"
                      value={isValueValid ? person.name : ''}
                      onChange={(e) => {
                        const updated = [...personDetails];
                        const selectedName = e.target.value;
                        updated[index].name = selectedName;

                        const matchingFamily = closeFamily.find(f => f.full_name === selectedName);
                        if (matchingFamily) {
                          updated[index].person_type = isAdult(matchingFamily.birth_date)
                            ? 'adulte_famille'
                            : 'enfant_famille';
                        } else {
                          updated[index].person_type = person.person_type?.startsWith('adulte')
                            ? 'adulte_amis'
                            : 'enfant_amis';
                        }

                        setPersonDetails(updated);
                      }}
                    >
                      {options.map(option => (
                        <MenuItem key={option.id} value={option.name}>
                          {option.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 160 }}>
                    <DatePicker
                      label="Date d'arrivée"
                      value={person.arrivalDate}
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
                      {timeOptions.map(t => (
                        <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>
                      ))}
                    </TextField>
                  </Box>
                </Stack>

                {/* Ligne 2 : départ (date/heure) */}
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  mt={2}
                  alignItems="flex-start"
                >
                  <Box sx={{ flex: 1, minWidth: 160 }}>
                    <DatePicker
                      label="Date de départ"
                      value={person.departureDate}
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
                      {timeOptions.map(t => (
                        <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>
                      ))}
                    </TextField>
                  </Box>
                </Stack>
              </Box>
            );
          })}

          {/* Boutons d'ajout */}
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

      {/* Actions en bas */}
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Stack direction="row" spacing={2} justifyContent="flex-end" width="100%">
          <Button onClick={onClose} variant="outlined">Annuler</Button>
          {!isReadOnly && (
            <Button variant="contained" onClick={handleSave}>
              Enregistrer
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );

};
