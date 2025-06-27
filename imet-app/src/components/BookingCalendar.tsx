import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Dialog, IconButton, Divider, Accordion, AccordionSummary,
  AccordionDetails, useMediaQuery, Stack
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { Booking, PersonDetails } from '../types/booking';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO,
  format, addMonths, subMonths
} from 'date-fns';
import { fr } from 'date-fns/locale';

interface BookingCalendarProps {
  bookings: Booking[];
}

const getMealsForDate = (booking: Booking, date: Date) => {
  const start = parseISO(booking.start_date);
  const end = parseISO(booking.end_date);
  const isStart = isSameDay(date, start);
  const isEnd = isSameDay(date, end);
  const arrival = booking.arrival_time;
  const departure = booking.departure_time;
  let breakfast = true, lunch = true, dinner = true;

  if (isStart) {
    if (arrival === 'afternoon') breakfast = false;
    if (arrival === 'evening') breakfast = lunch = false;
  }
  if (isEnd) {
    if (departure === 'morning') lunch = dinner = false;
    if (departure === 'afternoon') dinner = false;
  }

  return { breakfast, lunch, dinner };
};

export const BookingCalendar: React.FC<BookingCalendarProps> = ({ bookings }) => {
  const isMobile = useMediaQuery('(max-width:600px)');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
  }, [currentMonth]);

  const bookingsByDay = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach((booking) => {
      const start = parseISO(booking.start_date);
      const end = parseISO(booking.end_date);
      eachDayOfInterval({ start, end }).forEach((date) => {
        const key = format(date, 'yyyy-MM-dd');
        if (!map[key]) map[key] = [];
        map[key].push(booking);
      });
    });
    return map;
  }, [bookings]);

  const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedBookings = bookingsByDay[selectedKey] || [];

  const mealLabels = {
    breakfast: 'Petit-déjeuner',
    lunch: 'Déjeuner',
    dinner: 'Dîner'
  };

  const mealKeys: (keyof typeof mealLabels)[] = ['breakfast', 'lunch', 'dinner'];

  const getBoxColor = (totalPeople: number) => {
    if (totalPeople > 15) return '#ffcdd2'; // rouge pâle
    if (totalPeople >= 1) return '#c8e6c9'; // vert pâle
    return 'white';
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <IconButton onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
          <ArrowBackIosNewIcon />
        </IconButton>
        <Typography variant="h6">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </Typography>
        <IconButton onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
          <ArrowForwardIosIcon />
        </IconButton>
        <DatePicker
          views={['year', 'month']}
          label="Aller au mois"
          value={currentMonth}
          onChange={(date) => date && setCurrentMonth(date)}
          slotProps={{ textField: { size: 'small' } }}
        />
      </Stack>

      {isMobile ? (
        <Stack spacing={1}>
          {daysInMonth.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDay[key] || [];
            const totalPeople = dayBookings.reduce((acc, b) => acc + b.adults + b.children, 0);
            const firstName = dayBookings[0]?.profiles?.full_name || '—';

            return (
              <Box
                key={key}
                sx={{ border: '1px solid #ccc', p: 1, cursor: 'pointer', backgroundColor: getBoxColor(totalPeople) }}
                onClick={() => setSelectedDate(day)}
              >
                <Typography variant="subtitle2">
                  {format(day, 'EEEE d MMM', { locale: fr })}
                </Typography>
                <Typography variant="caption">👥 {totalPeople} - 👤 {firstName}</Typography>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {daysInMonth.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDay[key] || [];
            const totalPeople = dayBookings.reduce((acc, b) => acc + b.adults + b.children, 0);
            const firstName = dayBookings[0]?.profiles?.full_name || '—';

            return (
              <Box
                key={key}
                sx={{ border: '1px solid #ccc', p: 1, minHeight: { xs: 60, sm: 80 }, cursor: 'pointer', backgroundColor: getBoxColor(totalPeople) }}
                onClick={() => setSelectedDate(day)}
              >
                <Typography variant="subtitle2">
                  {format(day, 'd MMM', { locale: fr })}
                </Typography>
                <Typography variant="caption">👥 {totalPeople}</Typography><br />
                <Typography variant="caption">👤 {firstName}</Typography>
              </Box>
            );
          })}
        </Box>
      )}

      <Dialog fullScreen open={!!selectedDate} onClose={() => setSelectedDate(null)}>
        <Box sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Détail pour le {selectedDate && format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </Typography>
            <IconButton onClick={() => setSelectedDate(null)}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ mt: 4, display: isMobile ? 'block' : 'flex', gap: 2 }}>
            {mealKeys.map((mealKey) => {
              const label = mealLabels[mealKey];
              const mealParticipants: string[] = [];
              const allNames = new Set<string>();

              selectedBookings.forEach((booking) => {
                const meals = getMealsForDate(booking, selectedDate!);
                if (meals[mealKey]) {
                  const reservant = booking.profiles?.full_name || 'Réservant inconnu';
                  if (!allNames.has(reservant)) {
                    mealParticipants.push(`👉 ${reservant}`);
                    allNames.add(reservant);
                  }
                  try {
                    const details: PersonDetails[] = JSON.parse(booking.persons_details || '[]');
                    details.forEach((p, i) => {
                      if (!allNames.has(p.name)) {
                        mealParticipants.push(i === 0 ? `  — ${p.name}` : `— ${p.name}`);
                        allNames.add(p.name);
                      }
                    });
                  } catch (e) {}
                }
              });

              const total = allNames.size;

              return (
                <Box key={mealKey} sx={{ flex: 1 }}>
                  {isMobile ? (
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1">{label} — 👥 {total}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        {mealParticipants.length > 0 ? (
                          mealParticipants.map((name, idx) => (
                            <Typography key={idx} variant="body2">{name}</Typography>
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">Aucun participant</Typography>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  ) : (
                    <Box>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>{label} — 👥 {total}</Typography>
                      {mealParticipants.length > 0 ? (
                        mealParticipants.map((name, idx) => (
                          <Typography key={idx} variant="body2">{name}</Typography>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">Aucun participant</Typography>
                      )}
                      <Divider sx={{ mt: 2 }} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};
