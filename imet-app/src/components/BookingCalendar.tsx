// 🎨 BookingCalendar avec corrections visuelles et logiques
import React, { useMemo, useState, useRef, useEffect } from 'react';

import {
  Box, Typography, Dialog, IconButton, Chip, Card, CardContent, Stack,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { Booking, PersonDetails } from '../types/booking';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO,
  format, addMonths, subMonths, startOfWeek, endOfWeek
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

const getBoxColor = (peopleMorning: number, peopleEvening: number) => {
  const colorMorning = peopleMorning > 13 ? '#ffcdd2' : peopleMorning > 0 ? '#c8e6c9' : '#ffffff';
  const colorEvening = peopleEvening > 13 ? '#ffcdd2' : peopleEvening > 0 ? '#c8e6c9' : '#ffffff';

  if (colorMorning === colorEvening) return colorMorning;
  return `linear-gradient(120deg, ${colorEvening} 50%, ${colorMorning} 50%)`;
};

const mealLabels = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner'
};
const mealIcons = {
  breakfast: '🥐',
  lunch: '🍽️',
  dinner: '🌙'
};
const mealColors: Record<string, string> = {
  breakfast: '#fff3e0',
  lunch: '#e3f2fd',
  dinner: '#f3e5f5'
};
const mealKeys: (keyof typeof mealLabels)[] = ['breakfast', 'lunch', 'dinner'];

export const BookingCalendar: React.FC<BookingCalendarProps> = ({ bookings }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    });
  }, [currentMonth]);

  const bookingsByDay = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings
    .filter(b => b.status !== 'cancelled')
    .forEach((booking) => {
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const todayRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      if (todayRef.current) {
        todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, []);


  const renderDayCell = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd');
    const dayBookings = bookingsByDay[key] || [];
    const isToday = isSameDay(day, new Date());

    let morningCount = 0;
    let eveningCount = 0;
    let dormeurs: PersonDetails[] = [];

    dayBookings.forEach((booking) => {
      const details: PersonDetails[] = typeof booking.persons_details === 'string'
        ? JSON.parse(booking.persons_details)
        : booking.persons_details || [];

      details.forEach(p => {
        const arrival = p.arrivalDate ? new Date(p.arrivalDate) : undefined;
        const departure = p.departureDate ? new Date(p.departureDate) : undefined;

        if (!arrival || !departure) return;

        // Présent le matin (a passé la nuit précédente)
        if (day >= arrival && day < departure) {
          morningCount++;
          dormeurs.push(p);
        }

        // Présent le soir (va passer la nuit suivante)
        if (day > arrival && day <= departure) {
          eveningCount++;
        }
      });
    });

    return (
          <Box key={key} sx={{ border: '1px solid #ccc', p: 1, cursor: 'pointer', background: getBoxColor(morningCount, eveningCount), 
          boxShadow: isToday ? '0 0 0 2px #2196f3 inset' : undefined, borderRadius: 1 }} onClick={() => setSelectedDate(day)}>
            <Typography variant="subtitle2">{format(day, 'd', { locale: fr })}</Typography>
            <Typography variant="caption">Présents : {dormeurs.length}</Typography>
            <Box mt={1}>
              {dormeurs.map((p, i) => (
                <Chip
                  key={`${p.name}-${i}`}
                  label={p.name}
                  size="small"
                  variant="outlined"
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              ))}
            </Box>
          </Box>
        );
      };

      return (
        <Box>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <IconButton onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}><ArrowBackIosNewIcon /></IconButton>
            <Typography variant="h6">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</Typography>
            <IconButton onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}><ArrowForwardIosIcon /></IconButton>
            <DatePicker views={['year', 'month']} label="Aller au mois" value={currentMonth} onChange={(date) => date && setCurrentMonth(date)} slotProps={{ textField: { size: 'small' } }} />
          </Stack>

          {isMobile ? (
            <>
              <Stack spacing={1}>
                {daysInMonth.map((day, index) => (
                  <Box 
                    key={index}
                    ref={isSameDay(day, new Date()) ? todayRef : undefined}
                  >
                    {renderDayCell(day)}
                  </Box>
                ))}
              </Stack>

            </>
          ) : (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                  <Typography key={day} align="center" variant="caption" fontWeight="bold">{day}</Typography>
                ))}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                {daysInMonth.map(renderDayCell)}
              </Box>
            </>
          )}

          <Dialog fullScreen open={!!selectedDate} onClose={() => setSelectedDate(null)}>
            <Box sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h5">Détail pour le {selectedDate && format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}</Typography>
                <IconButton onClick={() => setSelectedDate(null)}><CloseIcon /></IconButton>
              </Box>

          <Box mt={2}>
            {/* Repas */}
            {mealKeys.map((mealKey) => {
              const label = mealLabels[mealKey];
              const icon = mealIcons[mealKey];
              const bgColor = mealColors[mealKey];
              const chips: React.ReactNode[] = [];

              selectedBookings.forEach((booking) => {
                const meals = getMealsForDate(booking, selectedDate!);
                if (!meals[mealKey]) return;

                try {
                  const details: PersonDetails[] = typeof booking.persons_details === 'string'
                    ? JSON.parse(booking.persons_details)
                    : booking.persons_details || [];

                  const peopleThatDay = details.filter(p => {
                    const arrival = p.arrivalDate ? new Date(p.arrivalDate) : undefined;
                    const departure = p.departureDate ? new Date(p.departureDate) : undefined;
                    return arrival && departure && selectedDate! >= arrival && selectedDate! <= departure;
                  });

                  peopleThatDay.forEach((p) => {
                    const isAdult = (p.person_type || '').startsWith('adulte');
                    const isChild = (p.person_type || '').startsWith('enfant');
                    const color = isAdult ? 'default' : isChild ? 'success' : 'default';
                    chips.push(
                      <Chip
                        key={`${p.name}-${Math.random()}`}
                        label={`${p.name}`}
                        color={color as any}
                        variant="outlined"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    );
                  });
                } catch (e) {
                  console.error('Erreur parsing persons_details:', e);
                }
              });

              if (chips.length === 0) return null;

              return (
                <Card key={mealKey} sx={{ mb: 3, backgroundColor: bgColor }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {icon} {label} — 👥 {chips.length}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {chips}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}


            {/* 🛌 Section Nuit */}
            {(() => {
              const dormeurs = selectedBookings.flatMap((booking) => {
                try {
                  const details: PersonDetails[] = typeof booking.persons_details === 'string'
                    ? JSON.parse(booking.persons_details)
                    : booking.persons_details || [];

                  return details.filter(p => {
                    const arrival = p.arrivalDate ? new Date(p.arrivalDate) : undefined;
                    const departure = p.departureDate ? new Date(p.departureDate) : undefined;
                    return arrival && departure && selectedDate! >= arrival && selectedDate! < departure;
                  });
                } catch {
                  return [];
                }
              });
              if (dormeurs.length === 0) return null;
              return (
                <Card sx={{ mb: 3, backgroundColor: '#e0f7fa' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      🛌 Nuit — 👥 {dormeurs.length}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {dormeurs.map((p) => (
                        <Chip
                          key={`${p.name}-${Math.random()}`}
                          label={`${p.name}`}
                          variant="outlined"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })()}

            
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};
