import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Select,
  Button, IconButton, TextField, MenuItem, Stack, Typography, Box
} from '@mui/material';
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
  const { data: allBookings = [] } = useBookings();
  const updateBooking = useUpdateBooking();
  const { enqueueSnackbar } = useSnackbar();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

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

  const handleAddPerson = () => {
    setPersonDetails([...personDetails, {
      name: 'Nouveau participant',
      arrivalDate: booking.start_date ? new Date(booking.start_date) : null,
      arrivalTime: booking.arrival_time,
      departureDate: booking.end_date ? new Date(booking.end_date) : null,
      departureTime: booking.departure_time,
      person_type: 'adulte_amis'
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

    const overlapping = hasOverlappingBooking(
      new Date(booking.start_date),
      new Date(booking.end_date),
      booking.user_id,
      allBookings.filter(b => b.id !== booking.id)
    );

    if (overlapping) {
      enqueueSnackbar('Conflit : un autre séjour existe déjà à ces dates.', { variant: 'error' });
      return;
    }

    try {
      const totalCost = await calculateBookingCost(personDetails);

      updateBooking.mutate({
        id: booking.id,
        data: {
          persons_details: personDetails,
          total_cost: totalCost
        }
      }, {
        onSuccess: () => {
          enqueueSnackbar('Séjour mis à jour avec succès.', { variant: 'success' });
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
        <Stack spacing={2}>
          {personDetails.map((person, index) => {
            const options = (person.person_type || '').startsWith('adulte')
              ? getAdultOptions()
              : getChildOptions();

            const isValueValid = options.some(opt => opt.name === person.name);

            return (
              <Box key={index} sx={{ border: '1px solid #ccc', borderRadius: 2, p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography>Participant {index + 1}</Typography>
                  {!isReadOnly && (
                    <IconButton onClick={() => handleRemovePerson(index)}>
                      <CloseIcon />
                    </IconButton>
                  )}
                </Stack>

                <Stack direction={isMobile ? 'column' : 'row'} spacing={2} mt={1}>
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

                  <DatePicker
                    label="Arrivée"
                    value={person.arrivalDate}
                    onChange={(d) => handleChangePerson(index, 'arrivalDate', d)}
                    disabled={isReadOnly}
                  />

                  <TextField
                    select
                    label="Heure arrivée"
                    value={person.arrivalTime}
                    onChange={(e) => handleChangePerson(index, 'arrivalTime', e.target.value)}
                    disabled={isReadOnly}
                    fullWidth
                  >
                    {timeOptions.map(t => (
                      <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <Stack direction={isMobile ? 'column' : 'row'} spacing={2} mt={1}>
                  <DatePicker
                    label="Départ"
                    value={person.departureDate}
                    onChange={(d) => handleChangePerson(index, 'departureDate', d)}
                    disabled={isReadOnly}
                  />

                  <TextField
                    select
                    label="Heure départ"
                    value={person.departureTime}
                    onChange={(e) => handleChangePerson(index, 'departureTime', e.target.value)}
                    disabled={isReadOnly}
                    fullWidth
                  >
                    {timeOptions.map(t => (
                      <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </Box>
            );
          })}


          {!isReadOnly && (
            <Button startIcon={<AddIcon />} onClick={handleAddPerson}>
              Ajouter un participant
            </Button>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        {!isReadOnly && (
          <Button variant="contained" onClick={handleSave}>
            Enregistrer
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
