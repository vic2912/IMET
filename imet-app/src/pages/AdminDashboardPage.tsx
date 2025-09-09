// src/pages/AdminDashboardPage.tsx
import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Select, MenuItem, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper,
  Stack, CircularProgress
} from '@mui/material';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useAdminBookings } from '../hooks/useBookings';
import { parseISO } from 'date-fns';
import { calculateNightsAndDays, getPresenceDayList, getUniqueNightList } from '../utils/bookingUtils';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

const PIE_COLORS = ['#4caf50', '#ffa726', '#ef5350'];
const fmtInt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
const fmtEUR = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function AdminDashboardPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: bookings = [], isLoading } = useAdminBookings();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { userStats, paymentStats } = useMemo(() => {
  const userStats: Record<string, {
    name: string; stays: number;
    nights: number; uniqueNights: Set<string>;
    days: number; uniqueDays: Set<string>;
    total: number; paid: number;
  }> = {};

  let totalPaid = 0, totalUnpaid = 0, totalLate = 0;

  // ⬇️ Filtre: on exclut les séjours annulés
  const filtered = (bookings ?? []).filter(b => b.status !== 'cancelled');

  filtered.forEach(booking => {
    const yearOfBooking = parseISO(booking.start_date).getFullYear();
    if (yearOfBooking !== year) return;

    const userId = booking.user_id;
    const name = booking.profiles?.full_name || 'Inconnu';
    const people = booking.persons_details || [];

    let totalNights = 0;
    let totalDays = 0;

    if (!userStats[userId]) {
      userStats[userId] = {
        name, stays: 0,
        nights: 0, uniqueNights: new Set(),
        days: 0, uniqueDays: new Set(),
        total: 0, paid: 0,
      };
    }

    people.forEach(person => {
      if (!person.arrivalDate || !person.departureDate) return;
      const arrival = new Date(person.arrivalDate);
      const departure = new Date(person.departureDate);
      const { nights, days } = calculateNightsAndDays(
        arrival, departure, person.arrivalTime, person.departureTime
      );
      totalNights += nights;
      totalDays += days;

      getPresenceDayList(
        person.arrivalDate, person.arrivalTime, person.departureDate, person.departureTime
      ).forEach(d => userStats[userId].uniqueDays.add(d));

      getUniqueNightList(person.arrivalDate, person.departureDate)
        .forEach(d => userStats[userId].uniqueNights.add(d));
    });

    userStats[userId].stays++;
    userStats[userId].nights += totalNights;
    userStats[userId].days += totalDays;

    userStats[userId].total += booking.total_cost || 0;

    if (booking.status === 'paid') {
      userStats[userId].paid += booking.total_cost || 0;
      totalPaid += booking.total_cost || 0;
    } else if (booking.status === 'pending') {
      if (new Date(booking.end_date) < new Date()) totalLate += booking.total_cost || 0;
      else totalUnpaid += booking.total_cost || 0;
    }
  });

  return { userStats, paymentStats: { paid: totalPaid, unpaid: totalUnpaid, late: totalLate } };
}, [bookings, year]);

  const pieData = [
    { name: 'Payé', value: paymentStats.paid },
    { name: 'À venir', value: paymentStats.unpaid },
    { name: 'En retard', value: paymentStats.late },
  ];

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    // Zone scrollable indépendante du layout admin (critique sur mobile)
    <Box
      sx={{
        height: 'calc(100vh - var(--imet-header-offset, 64px))',
        overflow: 'auto',
        px: { xs: 1.5, md: 3 },
        py: { xs: 2, md: 3 },
        // si un drawer fixe existe, laisse de la place en desktop
        pl: { md: 'var(--admin-rail-offset, 0px)' },
        WebkitOverflowScrolling: 'touch',
        bgcolor: 'background.default',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography variant="h4">Statistiques annuelles</Typography>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} size={isMobile ? 'small' : 'medium'}>
          {[2023, 2024, 2025].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>) }
        </Select>
      </Stack>

      {/* Graphe avec hauteur garantie */}
      <Box mt={4}>
        <Typography variant="h6">Paiements</Typography>
        <Card sx={{ mt: 1 }}>
          <CardContent>
            <Box sx={{ height: { xs: 260, sm: 300 }, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((_, i) => <Cell key={`cell-${i}`} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={2}>
              <Typography>✅ Total payé : {fmtEUR(paymentStats.paid)}</Typography>
              <Typography>🕒 Total à venir : {fmtEUR(paymentStats.unpaid)}</Typography>
              <Typography>⚠️ Total en retard : {fmtEUR(paymentStats.late)}</Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Tableau avec scroll horizontal + 1ère colonne sticky */}
      {/* Tableau avec scroll horizontal + 1ère colonne sticky */}
      <Box mt={4}>
        <Typography variant="h6">Utilisateurs</Typography>

        <TableContainer
          component={Paper}
          sx={{
            mt: 2,
            position: 'relative',
            overflowX: 'auto',
            overflowY: 'hidden',
            maxWidth: '100%',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Table
            size="small"
            // table plus compacte + colonnes resserrées
            sx={{
              minWidth: 720, // plus étroit qu'avant
              '& th, & td': { py: 0.5, px: 1 }, // densifie les cellules
            }}
          >
            <TableHead>
              <TableRow>
                {/* Colonne “Nom” sticky + largeur bien réduite en mobile */}
                <TableCell
                  sx={{
                    position: 'sticky', left: 0, zIndex: 2,
                    bgcolor: 'background.paper',
                    minWidth: { xs: 112, sm: 140, md: 180 },
                    maxWidth: { xs: 140, sm: 200, md: 240 },
                    pr: 1,
                    fontWeight: 700,
                    fontSize: { xs: '0.875rem', sm: '0.9rem' },
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  Nom
                </TableCell>
                <TableCell align="right" sx={{ width: { xs: 84, sm: 96 } }}>Séjours</TableCell>
                <TableCell align="right" sx={{ width: { xs: 110, sm: 130 } }}>Nuits uniques</TableCell>
                <TableCell align="right" sx={{ width: { xs: 120, sm: 140 } }}>Nuitées totales</TableCell>
                <TableCell align="right" sx={{ width: { xs: 110, sm: 130 } }}>Jours uniques</TableCell>
                <TableCell align="right" sx={{ width: { xs: 130, sm: 150 } }}>Journées totales</TableCell>
                <TableCell align="right" sx={{ width: { xs: 120, sm: 140 } }}>Facturé (€)</TableCell>
                <TableCell align="right" sx={{ width: { xs: 100, sm: 120 } }}>Payé (€)</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {Object.entries(userStats).map(([id, user]) => (
                <TableRow key={id} hover>
                  <TableCell
                    sx={{
                      position: 'sticky', left: 0, zIndex: 1,
                      bgcolor: 'background.paper',
                      minWidth: { xs: 112, sm: 140, md: 180 },
                      maxWidth: { xs: 140, sm: 200, md: 240 },
                      pr: 1,
                      fontWeight: 600,
                      fontSize: { xs: '0.875rem', sm: '0.9rem' },
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                    title={user.name}
                  >
                    {user.name}
                  </TableCell>

                  <TableCell align="right">{fmtInt(user.stays)}</TableCell>
                  <TableCell align="right">{fmtInt(user.uniqueNights.size)}</TableCell>
                  <TableCell align="right">{fmtInt(user.nights)}</TableCell>
                  <TableCell align="right">{fmtInt(user.uniqueDays.size)}</TableCell>
                  <TableCell align="right">{fmtInt(user.days)}</TableCell>
                  <TableCell align="right">{fmtEUR(user.total)}</TableCell>
                  <TableCell align="right">{fmtEUR(user.paid)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

    </Box>
  );
}
