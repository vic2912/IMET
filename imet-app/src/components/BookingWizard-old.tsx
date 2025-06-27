import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, TextField, Select, MenuItem,
  Stack, Typography, Stepper, Step, StepLabel, useMediaQuery, Fade, Chip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useTheme } from '@mui/material/styles';
import { isBefore, parseISO } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useFamily } from '../hooks/useFamily';
import { useBookings } from '../hooks/useBookings';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { useUpdateBooking } from '../hooks/useUpdateBooking';
import { hasOverlappingBooking } from '../utils/bookingUtils';
import { isAdult } from '../utils/ageUtils';
import type {Booking, PersonDetails, ExtendedCreateBookingDataForServer, ArrivalTime, DepartureTime, PersonDetailsForServer } from '../types/booking';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';

interface BookingWizardProps {
  open: boolean;
  onClose: () => void;
  bookingToEdit: Booking | null;
}

const timeOptions: ArrivalTime[] = ['morning', 'afternoon', 'evening'];
const timeLabels = { morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir' };
const steps = ['Informations générales', 'Participants'];

export const BookingWizard: React.FC<BookingWizardProps> = ({ open, onClose, bookingToEdit }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const { closeFamily } = useFamily(user?.id || '');
  const [step, setStep] = useState(0);
  const { enqueueSnackbar } = useSnackbar();
  const { data: bookings = [] } = useBookings(user?.id);
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<ArrivalTime>('morning');
  const [endTime, setEndTime] = useState<DepartureTime>('afternoon');
  const [adults, setAdults] = useState<number>(1);
  const [children, setChildren] = useState<number>(0);
  const [personDetails, setPersonDetails] = useState<PersonDetails[]>([]);
  const [hasGeneratedParticipants, setHasGeneratedParticipants] = useState(false);

  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  const isEditMode = !!bookingToEdit;
  
  const generateParticipants = () => {
    let participants: PersonDetails[] = [];

    // Générer les adultes
    for (let i = 0; i < adults; i++) {
      participants.push({
        name: 'Adulte',
        arrivalDate: startDate,
        arrivalTime: startTime,
        departureDate: endDate,
        departureTime: endTime,
        person_type: 'adulte_amis'
      });
    }

    // Générer les enfants
    for (let i = 0; i < children; i++) {
      participants.push({
        name: 'Enfant',
        arrivalDate: startDate,
        arrivalTime: startTime,
        departureDate: endDate,
        departureTime: endTime,
        person_type: 'enfant_amis'
      });
    }

    setPersonDetails(participants);
    setHasGeneratedParticipants(true);
  };


  const getAdultOptions = () => {
    return [
      { id: user!.id, name: user!.full_name }, // On ajoute soi-même
      ...closeFamily
        .filter(f => isAdult(f.birth_date))
        .map(f => ({ id: f.id, name: f.full_name })),
      { id: 'adulte_generique', name: 'Adulte' } // Toujours laisser la valeur générique
    ];
  };


  const getChildOptions = () => {
    return [
      ...closeFamily.filter(f => !isAdult(f.birth_date)).map(f => ({ id: f.id, name: f.full_name })),
      { id: 'enfant_generique', name: 'Enfant' }
    ];
  };


  useEffect(() => {
    if (open && bookingToEdit) {
      setStep(0);
      setStartDate(parseISO(bookingToEdit.start_date));
      setEndDate(parseISO(bookingToEdit.end_date));
      setStartTime(bookingToEdit.arrival_time);
      setEndTime(bookingToEdit.departure_time);
      setAdults(bookingToEdit.adults);
      setChildren(bookingToEdit.children);

      const rawPersons: PersonDetails[] = typeof bookingToEdit.persons_details === 'string'
        ? JSON.parse(bookingToEdit.persons_details)
        : bookingToEdit.persons_details;

      const parsedPersons: PersonDetails[] = rawPersons.map(person => ({
        ...person,
        arrivalDate: person.arrivalDate ? parseISO(person.arrivalDate as any) : null,
        departureDate: person.departureDate ? parseISO(person.departureDate as any) : null,
      }));

      setPersonDetails(parsedPersons);
      setHasGeneratedParticipants(true);
    } else if (open) {
      setStep(0);
      setStartDate(null);
      setEndDate(null);
      setStartTime('morning');
      setEndTime('afternoon');
      setAdults(1);
      setChildren(0);
      setPersonDetails([]);
      setHasGeneratedParticipants(false);
    }
  }, [open, bookingToEdit]);


  useEffect(() => {
    if (!open || step !== 1 || isEditMode || hasGeneratedParticipants) return;
    generateParticipants();
  }, [open, step, isEditMode, hasGeneratedParticipants]);

  const handleSubmit = () => {
    //console.log("handleSubmit déclenché");
    //console.log("startDate:", startDate);
    //console.log("endDate:", endDate);
    //console.log("user:", user?.id);

    if (!startDate || !endDate || !user?.id) return;
        if (!isEditMode && hasOverlappingBooking(startDate, endDate, user.id, bookings)) {
      alert("Conflit : il existe déjà une réservation sur cette période.");
      return;
    }

    for (const person of personDetails) {
      if (!person.arrivalDate || !person.departureDate) {
        alert(`Le participant ${person.name} n'a pas de dates complètes.`);
        return;
      }
      if (isBefore(person.departureDate, person.arrivalDate)) {
        alert(`Le départ ne peut pas être avant l'arrivée pour ${person.name}.`);
        return;
      }
    }

    const sanitizedPersonDetails: PersonDetailsForServer[] = personDetails.map(person => ({
      ...person,
      arrivalDate: person.arrivalDate ? format(person.arrivalDate, 'yyyy-MM-dd') : null,
      departureDate: person.departureDate ? format(person.departureDate, 'yyyy-MM-dd') : null
    }));


    const booking: ExtendedCreateBookingDataForServer = {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      arrival_time: startTime,
      departure_time: endTime,
      adults,
      children,
      booking_for_self: true,
      persons_details: sanitizedPersonDetails,
      status: 'pending'
    };

    const mutation = isEditMode
      ? updateBooking.mutate
      : createBooking.mutate;

    const mutationArgs = isEditMode
      ? { id: bookingToEdit!.id, data: booking }
      : { userId: user.id, data: booking };

    mutation(mutationArgs as any, {
      onSuccess: () => {
        enqueueSnackbar(isEditMode ? 'Séjour modifié' : 'Séjour créé', { variant: 'success' });
        onClose();
      }
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditMode ? 'Modifier un séjour' : 'Créer un séjour'}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ my: 2 }}>
          {steps.map(label => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
        </Stepper>

        <Fade in={step === 0} timeout={500} unmountOnExit>
          <Box>
            <Stack spacing={2}>
              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                <DatePicker
                  label="Date d'arrivée"
                  format="dd/MM/yyyy"
                  value={startDate}
                  onChange={(newDate) => {
                    setStartDate(newDate);
                    setIsEndDateOpen(true);
                  }}
                  slotProps={{ textField: { fullWidth: true } }}
                />
                <DatePicker
                  label="Date de départ"
                  format="dd/MM/yyyy"
                  value={endDate}
                  onChange={(newDate) => {
                    setEndDate(newDate);
                    setIsEndDateOpen(false);
                  }}
                  open={isEndDateOpen}
                  onOpen={() => setIsEndDateOpen(true)}
                  onClose={() => setIsEndDateOpen(false)}
                  referenceDate={startDate ?? undefined}
                  minDate={startDate ?? undefined}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Stack>

              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                <TextField label="Adultes" type="number" fullWidth value={adults} onChange={e => setAdults(Number(e.target.value))} />
                <TextField label="Enfants" type="number" fullWidth value={children} onChange={e => setChildren(Number(e.target.value))} />
              </Stack>

              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                <TextField
                  select
                  label="Heure d'arrivée"
                  fullWidth
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value as ArrivalTime)}
                >
                  {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                </TextField>

                <TextField
                  select
                  label="Heure de départ"
                  fullWidth
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value as DepartureTime)}
                >
                  {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                </TextField>
              </Stack>
            </Stack>
          </Box>
        </Fade>

        <Fade in={step === 1} timeout={500} unmountOnExit>
          <Box>
            <Typography variant="h6" gutterBottom>Participants</Typography>
            <Stack spacing={2}>
              {personDetails.map((p, index) => (
                <Box key={p.id ?? `person-${index}`} sx={{ border: '1px solid #ccc', borderRadius: 2, p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    <Typography variant="subtitle1">Participant {index + 1}</Typography>
                    <Chip label={index < adults ? 'Adulte' : 'Enfant'} color={index < adults ? 'primary' : 'success'} size="small" />
                  </Stack>
                  <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                    <Select
                      fullWidth
                      value={p.name}
                      onChange={(e) => {
                        const updated = [...personDetails];
                        updated[index].name = e.target.value;

                        // Mettre à jour le person_type
                        const selectedName = e.target.value;

                        if (index < adults) {
                          const matchingAdult = closeFamily.find(f => f.full_name === selectedName && isAdult(f.birth_date));
                          updated[index].person_type = matchingAdult ? 'adulte_famille' : 'adulte_amis';
                        } else {
                          const matchingChild = closeFamily.find(f => f.full_name === selectedName && !isAdult(f.birth_date));
                          updated[index].person_type = matchingChild ? 'enfant_famille' : 'enfant_amis';
                        }

                        setPersonDetails(updated);
                      }}
                    >
                      {(index < adults ? getAdultOptions() : getChildOptions()).map(option => (
                        <MenuItem key={option.id} value={option.name}>{option.name}</MenuItem>
                      ))}
                    </Select>

                    <DatePicker
                      format="dd/MM/yyyy"
                      value={p.arrivalDate}
                      onChange={(newDate) => {
                        const updated = [...personDetails];
                        updated[index].arrivalDate = newDate ?? null;  // On force null si jamais newDate est vide
                        setPersonDetails(updated);
                      }}
                      slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                    />

                    <TextField
                      select
                      label="Heure arrivée"
                      fullWidth
                      value={p.arrivalTime}
                      onChange={(e) => {
                        const updated = [...personDetails];
                        updated[index].arrivalTime = e.target.value as ArrivalTime;
                        setPersonDetails(updated);
                      }}
                      size="small"
                    >
                      {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                    </TextField> 
                    <DatePicker
                      format="dd/MM/yyyy"
                      value={p.departureDate}
                      onChange={(newDate) => {
                        const updated = [...personDetails];
                        updated[index].departureDate = newDate ?? null;  // On force null si jamais newDate est vide
                        setPersonDetails(updated);
                      }}
                      slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                    />
                    <TextField
                      select
                      label="Heure départ"
                      fullWidth
                      value={p.departureTime}
                      onChange={(e) => {
                        const updated = [...personDetails];
                        updated[index].departureTime = e.target.value as DepartureTime;
                        setPersonDetails(updated);
                      }}
                      size="small"
                    >
                      {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                    </TextField>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        </Fade>
      </DialogContent>
      <DialogActions>
        {step > 0 && <Button onClick={() => setStep(step - 1)}>Retour</Button>}
        {step < steps.length - 1 && (
          <Button disabled={!startDate || !endDate} onClick={() => setStep(step + 1)}>Suivant</Button>
        )}
        {step === steps.length - 1 && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isEditMode ? updateBooking.isPending : createBooking.isPending}
          >
            {isEditMode ? 'Enregistrer les modifications' : 'Valider'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
