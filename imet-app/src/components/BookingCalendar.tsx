// BookingCalendar.tsx
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Dialog, IconButton, Chip, Card, CardContent, Stack, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

import type { Booking } from '../types/booking';
import { buildPresenceMap } from '../utils/buildPresenceMap';

interface BookingCalendarProps {
  bookings: Booking[];
}

const mealOrder = ['morning', 'lunch', 'dinner'] as const;
const mealLabels = {
  morning: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner'
};
const mealIcons = {
  morning: '🥐',
  lunch: '🍽️',
  dinner: '🌙'
};
const mealColors = {
  morning: '#fff3e0',
  lunch: '#e3f2fd',
  dinner: '#f3e5f5'
};

const getBoxColor = (morningCount: number, nightCount: number) => {
  const colorMorning = morningCount > 13 ? '#ffcdd2' : morningCount > 0 ? '#c8e6c9' : '#ffffff';
  const colorEvening = nightCount > 13 ? '#ffcdd2' : nightCount > 0 ? '#c8e6c9' : '#ffffff';
  
  if (colorMorning === colorEvening) return colorMorning;
  return `linear-gradient(120deg, ${colorMorning} 50%, ${colorEvening} 50%)`;  
};

export const BookingCalendar: React.FC<BookingCalendarProps> = ({ bookings }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const todayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const presenceByDate = useMemo(() => buildPresenceMap(bookings), [bookings]);

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    });
  }, [currentMonth]);

  const renderDayCell = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd');
    const presence = presenceByDate[key];
    const isToday = isSameDay(day, new Date());

    return (
      <Box
        key={key}
        sx={{
          border: '1px solid #ccc',
          p: 1,
          cursor: 'pointer',
          background: getBoxColor(presence?.morning.length || 0, presence?.nuit.length || 0),
          boxShadow: isToday ? '0 0 0 2px #2196f3 inset' : undefined,
          borderRadius: 1
        }}
        onClick={() => setSelectedDate(day)}
      >
        <Typography variant="subtitle2">{format(day, 'd', { locale: fr })}</Typography>
        <Typography variant="caption">
          Présents : {presence?.maxPeople || 0} ({presence?.nuit.length || 0})
        </Typography>
        <Box mt={1}>
          {(presence?.nuit || []).map((p, i) => (
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

  const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedPresence = presenceByDate[selectedKey];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <IconButton onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}><ArrowBackIosNewIcon /></IconButton>
        <Typography variant="h6">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</Typography>
        <IconButton onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}><ArrowForwardIosIcon /></IconButton>
        <DatePicker views={['year', 'month']} label="Aller au mois" value={currentMonth} onChange={(date) => date && setCurrentMonth(date)} slotProps={{ textField: { size: 'small' } }} />
      </Stack>

      {isMobile ? (
        <Stack spacing={1}>
          {daysInMonth.map((day, index) => (
            <Box key={index} ref={isSameDay(day, new Date()) ? todayRef : undefined}>
              {renderDayCell(day)}
            </Box>
          ))}
        </Stack>
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
            <Typography variant="h5">Detail pour le {selectedDate && format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}</Typography>
            <IconButton onClick={() => setSelectedDate(null)}><CloseIcon /></IconButton>
          </Box>

          <Box mt={2}>
            {mealOrder.map(mealKey => {
              const people = selectedPresence?.[mealKey] || [];
              if (people.length === 0) return null;

              return (
                <Card key={mealKey} sx={{ mb: 3, backgroundColor: mealColors[mealKey] }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {mealIcons[mealKey]} {mealLabels[mealKey]} — 👥 {people.length}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {people.map((p, i) => (
                        <Chip
                          key={`${p.name}-${i}`}
                          label={p.name}
                          variant="outlined"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}

            {selectedPresence?.nuit.length ? (
              <Card sx={{ mb: 3, backgroundColor: '#e0f7fa' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    🛌 Nuit — 👥 {selectedPresence.nuit.length}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {selectedPresence.nuit.map((p, i) => (
                      <Chip
                        key={`${p.name}-${i}`}
                        label={p.name}
                        variant="outlined"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            ) : null}
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};
