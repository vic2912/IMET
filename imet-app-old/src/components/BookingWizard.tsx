import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, TextField, FormControl, InputLabel, Select, MenuItem,
  Stack, Typography, Stepper, Step, StepLabel, Table, TableBody,
  TableCell, TableHead, TableRow, useMediaQuery, Fade
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../hooks/useAuth';
import { useFamily } from '../hooks/useFamily';
import { useBookings } from '../hooks/useBookings';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { hasOverlappingBooking } from '../utils/bookingUtils';
import { isAdult } from '../utils/ageUtils';
import { PersonDetails, ExtendedCreateBookingData, ArrivalTime, DepartureTime } from '../types/booking';
import { format } from 'date-fns';

interface BookingWizardProps {
  open: boolean;
  onClose: () => void;
}

const timeOptions: ArrivalTime[] = ['morning', 'afternoon', 'evening'];
const timeLabels = { morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir' };
const steps = ['Informations générales', 'Participants'];

export const BookingWizard: React.FC<BookingWizardProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const { closeFamily } = useFamily(user?.id || '');
  const [step, setStep] = useState(0);

  const [bookingForSelf, setBookingForSelf] = useState(true);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<ArrivalTime>('afternoon');
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<DepartureTime>('morning');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [personDetails, setPersonDetails] = useState<PersonDetails[]>([]);

  const forUserId = bookingForSelf ? user?.id : selectedFamilyId;
  const { data: bookings = [] } = useBookings(forUserId);
  const createBooking = useCreateBooking();

  useEffect(() => {
    if (step !== 1 || !startDate || !endDate) return;
    const participants: PersonDetails[] = [];
    const familyTarget = bookingForSelf ? user : closeFamily.find(f => f.id === selectedFamilyId);
    if (familyTarget) {
      participants.push({ id: 'p1', name: familyTarget.full_name, arrivalDate: startDate, arrivalTime: startTime, departureDate: endDate, departureTime: endTime });
      const spouse = closeFamily.find(p => p.relationship === 'spouse');
      if (spouse) {
        participants.push({ id: 'p2', name: spouse.full_name, arrivalDate: startDate, arrivalTime: startTime, departureDate: endDate, departureTime: endTime });
      } else {
        participants.push({ id: 'p2', name: 'Adulte', arrivalDate: startDate, arrivalTime: startTime, departureDate: endDate, departureTime: endTime });
      }
      closeFamily.filter(p => p.relationship === 'child' && isAdult(p.birth_date)).forEach((child, index) => {
        participants.push({ id: `pa${index+1}`, name: child.full_name, arrivalDate: startDate, arrivalTime: startTime, departureDate: endDate, departureTime: endTime });
      });
      closeFamily.filter(p => p.relationship === 'child' && !isAdult(p.birth_date)).forEach((child, index) => {
        participants.push({ id: `pc${index+1}`, name: child.full_name, arrivalDate: startDate, arrivalTime: startTime, departureDate: endDate, departureTime: endTime });
      });
    }
    if (JSON.stringify(participants) !== JSON.stringify(personDetails)) {
      setPersonDetails(participants);
    }
  }, [step, bookingForSelf, selectedFamilyId, closeFamily, user, startDate, endDate, startTime, endTime, personDetails]);

  const handleSubmit = () => {
    if (!startDate || !endDate || !forUserId) return;
    if (hasOverlappingBooking(startDate, endDate, forUserId, bookings)) {
      alert("Conflit : il existe déjà une réservation sur cette période.");
      return;
    }
    const booking: ExtendedCreateBookingData = {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      arrival_time: startTime,
      departure_time: endTime,
      adults,
      children,
      booking_for_self: bookingForSelf,
      booking_for_name: bookingForSelf ? undefined : closeFamily.find(f => f.id === selectedFamilyId)?.full_name,
      persons_details: personDetails
    };
    createBooking.mutate({ userId: forUserId, data: booking }, { onSuccess: () => onClose() });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Créer un séjour</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ my: 2 }}>
          {steps.map(label => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
        </Stepper>

        <Fade in={step === 0} timeout={500} unmountOnExit>
          <Box>
            <Stack spacing={2}>
              <Typography>Pour qui ?</Typography>
              <Select value={bookingForSelf ? 'self' : 'other'} onChange={e => setBookingForSelf(e.target.value === 'self')} fullWidth>
                <MenuItem value="self">Pour moi</MenuItem>
                <MenuItem value="other">Pour un proche</MenuItem>
              </Select>

              {!bookingForSelf && (
                <FormControl fullWidth>
                  <InputLabel>Membre autorisé</InputLabel>
                  <Select value={selectedFamilyId} onChange={e => setSelectedFamilyId(e.target.value)}>
                    {closeFamily.filter(f => f.is_guardian).map(f => (
                      <MenuItem key={f.id} value={f.id}>{f.full_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                <DatePicker label="Date d'arrivée" format="dd/MM/yyyy" value={startDate} onChange={setStartDate} slotProps={{ textField: { fullWidth: true } }} />
                <FormControl fullWidth>
                  <InputLabel>Heure d'arrivée</InputLabel>
                  <Select value={startTime} onChange={(e) => setStartTime(e.target.value as ArrivalTime)}>
                    {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                <DatePicker label="Date de départ" format="dd/MM/yyyy" value={endDate} onChange={setEndDate} slotProps={{ textField: { fullWidth: true } }} />
                <FormControl fullWidth>
                  <InputLabel>Heure de départ</InputLabel>
                  <Select value={endTime} onChange={(e) => setEndTime(e.target.value as DepartureTime)}>
                    {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                <TextField label="Adultes" type="number" fullWidth value={adults} onChange={e => setAdults(Number(e.target.value))} />
                <TextField label="Enfants" type="number" fullWidth value={children} onChange={e => setChildren(Number(e.target.value))} />
              </Stack>
            </Stack>
          </Box>
        </Fade>

        <Fade in={step === 1} timeout={500} unmountOnExit>
          <Box>
            <Typography variant="h6">Participants</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Participant</TableCell>
                    <TableCell>Date arrivée</TableCell>
                    <TableCell>Heure arrivée</TableCell>
                    <TableCell>Date départ</TableCell>
                    <TableCell>Heure départ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {personDetails.map((p, idx) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <TextField value={p.name} onChange={e => { const updated = [...personDetails]; updated[idx].name = e.target.value; setPersonDetails(updated); }} fullWidth />
                      </TableCell>
                      <TableCell>
                        <DatePicker format="dd/MM/yyyy" value={p.arrivalDate} onChange={date => { const updated = [...personDetails]; updated[idx].arrivalDate = date!; setPersonDetails(updated); }} slotProps={{ textField: { fullWidth: true } }} />
                      </TableCell>
                      <TableCell>
                        <Select value={p.arrivalTime} onChange={e => { const updated = [...personDetails]; updated[idx].arrivalTime = e.target.value as ArrivalTime; setPersonDetails(updated); }} fullWidth>
                          {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <DatePicker format="dd/MM/yyyy" value={p.departureDate} onChange={date => { const updated = [...personDetails]; updated[idx].departureDate = date!; setPersonDetails(updated); }} slotProps={{ textField: { fullWidth: true } }} />
                      </TableCell>
                      <TableCell>
                        <Select value={p.departureTime} onChange={e => { const updated = [...personDetails]; updated[idx].departureTime = e.target.value as DepartureTime; setPersonDetails(updated); }} fullWidth>
                          {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </Fade>
      </DialogContent>

      <DialogActions>
        {step > 0 && <Button onClick={() => setStep(step - 1)}>Retour</Button>}
        {step < steps.length - 1 && <Button disabled={!startDate || !endDate} onClick={() => setStep(step + 1)}>Suivant</Button>}
        {step === steps.length - 1 && <Button variant="contained" onClick={handleSubmit} disabled={createBooking.isLoading}>Valider</Button>}
      </DialogActions>
    </Dialog>
  );
};
