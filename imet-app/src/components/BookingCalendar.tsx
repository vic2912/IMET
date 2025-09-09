// src/components/BookingCalendar.tsx

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Typography, Dialog, IconButton, Chip, Card, CardContent, Stack, useMediaQuery, Button,
  DialogTitle, DialogContent, DialogActions, Alert
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, addMonths, subMonths, isBefore, isAfter, parseISO, isValid
} from 'date-fns';
import { fr } from 'date-fns/locale';

import type { Booking } from '../types/booking';
import { buildPresenceMap } from '../utils/buildPresenceMap';
import { generatePresencePdf } from '../utils/generatePresencePdf';
import { CalendarLegend } from './CalendarLegend';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';

// ------------------ CONFIG LOG ------------------
const DEBUG = true; // passe à false pour couper tous les logs
const log = (...args: any[]) => { if (DEBUG) console.log('[BookingCalendar]', ...args); };
const group = (label: string, fn: () => void) => {
  if (!DEBUG) return fn();
  console.groupCollapsed(`🔎 ${label}`);
  try { fn(); } finally { console.groupEnd(); }
};
// ------------------------------------------------

interface BookingCalendarProps {
  bookings: Booking[];
  sx?: SxProps<Theme>;
}

const mealOrder = ['morning', 'lunch', 'dinner'] as const;
const mealLabels = { morning: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner' };
const mealIcons  = { morning: '🥐',            lunch: '🍽️',       dinner: '🌙'   };
const mealColors = { morning: '#fff3e0',       lunch: '#e3f2fd',   dinner: '#f3e5f5' };
const SMALL_PERSON_CHIP_SX = {height: 22, borderRadius: 1, '& .MuiChip-label': {
    px: 0.5, fontSize: 11, lineHeight: 1.1,},
};

/** Rouge si >13 (sur-occupation), vert si >0, blanc si 0 */
const getBoxColor = (morningCount: number, nightCount: number, maxCount: number) => {
  const colorMorning = morningCount > 13 ? '#ffcdd2' : morningCount > 0 ? '#c8e6c9' : '#ffffff';
  const colorEvening = nightCount   > 13 ? '#ffcdd2' : nightCount   > 0 ? '#c8e6c9' : '#ffffff';
  const colorDay     = maxCount     > 13 ? '#ffcdd2' : maxCount     > 0 ? '#c8e6c9' : '#ffffff';

  if (colorMorning === '#ffffff' && colorEvening === '#ffffff' && colorDay !== '#ffffff') {
    return colorDay;
  }
  if (colorMorning === colorEvening) return colorMorning;
  return `linear-gradient(120deg, ${colorMorning} 50%, ${colorEvening} 50%)`;
};

export const BookingCalendar: React.FC<BookingCalendarProps> = ({ bookings = [], sx }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const todayRef = useRef<HTMLDivElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStart, setExportStart] = useState<Date | null>(null);
  const [exportEnd, setExportEnd] = useState<Date | null>(null);

  // ---- Log initial ----
  useEffect(() => {
    group('Mount', () => {
      log('bookings prop (count):', bookings?.length ?? 0);
      if (Array.isArray(bookings)) {
        log('bookings[0] sample:', bookings[0]);
      } else {
        log('bookings n’est pas un tableau !', bookings);
      }
    });
  }, [bookings]);

  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const visibleStart = useMemo(
    () => startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    [currentMonth]
  );
  const visibleEnd = useMemo(
    () => endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
    [currentMonth]
  );

  // PERFS : ne garder que les séjours qui intersectent la fenêtre visible
  const bookingsInView = useMemo(() => {
    if (!bookings?.length) return [];
    const result = bookings.filter((b) => {
      // parse robustement les dates
      const bs = typeof b.start_date === 'string' ? parseISO(b.start_date) : new Date(b.start_date);
      const be = typeof b.end_date   === 'string' ? parseISO(b.end_date)   : new Date(b.end_date);
      if (!isValid(bs) || !isValid(be)) {
        DEBUG && console.warn('[BookingCalendar] Invalid booking dates:', b);
        return false;
      }
      const outside = isBefore(be, visibleStart) || isAfter(bs, visibleEnd);
      return !outside;
    });

    group('Filtrage bookingsInView', () => {
      log('visibleStart:', format(visibleStart, 'yyyy-MM-dd'));
      log('visibleEnd  :', format(visibleEnd,   'yyyy-MM-dd'));
      log('total bookings:', bookings.length, '-> in view:', result.length);
      if (result[0]) {
        const b = result[0] as any;
        log('sample in view:', {
          start_date: b.start_date, end_date: b.end_date, name: b?.name || b?.id
        });
      }
    });

    return result;
  }, [bookings, visibleStart, visibleEnd]);

  const presenceByDate = useMemo(() => {
    const map = buildPresenceMap(bookingsInView);

    group('buildPresenceMap output (échantillon)', () => {
      const keys = Object.keys(map).sort();
      log('dates couvertes:', keys.length, keys.slice(0, 5), keys.length > 5 ? '…' : '');
      if (keys[0]) {
        log(keys[0], map[keys[0]]);
      }
    });

    return map;
  }, [bookingsInView]);

  const daysInMonth = useMemo(() => {
    const interval = eachDayOfInterval({ start: visibleStart, end: visibleEnd });
    group('daysInMonth', () => log('count:', interval.length, 'range:', format(visibleStart,'yyyy-MM-dd'), '->', format(visibleEnd,'yyyy-MM-dd')));
    return interval;
  }, [visibleStart, visibleEnd]);

  const handleExportPdf = useCallback(() => {
    group('Export PDF', () => {
      log('exportStart:', exportStart, 'exportEnd:', exportEnd);
    });
    if (exportStart && exportEnd) {
      generatePresencePdf(
        presenceByDate,
        format(exportStart, 'yyyy-MM-dd'),
        format(exportEnd, 'yyyy-MM-dd')
      );
    }
    setExportOpen(false);
  }, [exportStart, exportEnd, presenceByDate]);

  const renderDayCell = useCallback((day: Date) => {
    const key = format(day, 'yyyy-MM-dd');
    const presence = presenceByDate[key];
    const isToday = isSameDay(day, new Date());

    DEBUG && log('renderDayCell', key, presence ? {
      morning: presence.morning?.length ?? 0,
      lunch  : presence.lunch?.length ?? 0,
      dinner : presence.dinner?.length ?? 0,
      nuit   : presence.nuit?.length ?? 0,
      max    : presence.maxPeople ?? 0
    } : '—');

    return (
      <Box
        key={key}
        sx={{
          border: '1px solid #ccc',
          p: 1,
          cursor: 'pointer',
          background: getBoxColor(presence?.morning?.length || 0, presence?.nuit?.length || 0, presence?.maxPeople || 0),
          boxShadow: isToday ? '0 0 0 2px #2196f3 inset' : undefined,
          borderRadius: 1,
          minHeight: 96
        }}
        onClick={() => setSelectedDate(day)}
        ref={isToday ? todayRef : undefined}
      >
        <Typography variant="subtitle2">{format(day, 'd', { locale: fr })}</Typography>
        <Typography
          variant="body2"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', fontSize: '0.9rem' }}
        >
          {/* Journée (max de la journée toutes présences confondues) */}
          <PeopleOutlineIcon fontSize="inherit" aria-hidden />
          :
          <LightModeOutlinedIcon fontSize="inherit" aria-label="Journée" />
          {presence?.maxPeople ?? 0}

          <Box component="span" sx={{ mx: 0.5, opacity: 0.6, userSelect: 'none' }}>•</Box>

          {/* Nuit (personnes qui dorment) */}
          <HotelOutlinedIcon fontSize="inherit" aria-label="Nuit" />
          {presence?.nuit?.length ?? 0}

        </Typography>
        <Box mt={1}>
          {(presence?.nuit || []).map((p: any, i: number) => (
          <Chip
            key={`${p.name}-${i}`}
            label={p.name}
            size="small"
            variant="outlined"
            sx={{ mr: 0.5, mb: 0.5, ...SMALL_PERSON_CHIP_SX }}
          />
          ))}
        </Box>
      </Box>
    );
  }, [presenceByDate]);

  const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedPresence = presenceByDate[selectedKey];

  return (
    <Box sx={sx}>
      {/* Légende compacte */}
      <CalendarLegend sx={{ mb: 1 }} />

      {!bookings?.length && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Aucune réservation fournie au composant. Passe un tableau <code>bookings</code> pour voir les données.
        </Alert>
      )}

      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <IconButton aria-label="Mois précédent" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
          <ArrowBackIosNewIcon />
        </IconButton>
        <Typography variant="h6">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </Typography>
        <IconButton aria-label="Mois suivant" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
          <ArrowForwardIosIcon />
        </IconButton>
        <Button variant="text" onClick={() => setCurrentMonth(new Date())}>Aujourd’hui</Button>

        {/* IMPORTANT : le DatePicker doit renvoyer un Date si tu es sur AdapterDateFns */}
        <DatePicker
          views={['year', 'month']}
          label="Aller au mois"
          value={currentMonth}
          onChange={(date: any) => {
            // Si jamais l’adapter n’est pas DateFns, essaye de convertir :
            const asDate: Date | null =
              date == null ? null :
              date instanceof Date ? date :
              typeof date?.toDate === 'function' ? date.toDate() : // Dayjs
              (isValid(new Date(date)) ? new Date(date) : null);

            if (asDate) {
              setCurrentMonth(asDate);
              DEBUG && log('DatePicker -> setCurrentMonth', asDate.toISOString());
            } else {
              DEBUG && console.warn('[BookingCalendar] DatePicker onChange: valeur non convertible en Date', date);
            }
          }}
          slotProps={{ textField: { size: 'small' } }}
        />

        <Button variant="outlined" onClick={() => setExportOpen(true)} sx={{ ml: 'auto' }}>
          Exporter PDF
        </Button>
      </Stack>

      {isMobile ? (
        <Stack spacing={1}>
          {daysInMonth.map((day, index) => (
            <Box key={index}>
              {renderDayCell(day)}
            </Box>
          ))}
        </Stack>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1, py: 0.5 }}>
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
                      {people.map((p: any, i: number) => (
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

            {selectedPresence?.nuit?.length ? (
              <Card sx={{ mb: 3, backgroundColor: '#e0f7fa' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    🛌 Nuit — 👥 {selectedPresence.nuit.length}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {selectedPresence.nuit.map((p: any, i: number) => (
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

      <Dialog open={exportOpen} onClose={() => setExportOpen(false)}>
        <DialogTitle>Exporter le PDF</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <DatePicker label="Du" value={exportStart} onChange={(d: any) => setExportStart(d instanceof Date ? d : (typeof d?.toDate==='function' ? d.toDate() : d))} />
            <DatePicker label="Au"  value={exportEnd}   onChange={(d: any) => setExportEnd(  d instanceof Date ? d : (typeof d?.toDate==='function' ? d.toDate() : d))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleExportPdf} disabled={!exportStart || !exportEnd}>
            Générer le PDF
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
