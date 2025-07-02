// React et hooks
import React, { useState } from 'react';

// MUI
import {
  Box, Typography, Fab, Tooltip, Stack, Card, CardContent, Button
} from '@mui/material';
import { Add as AddIcon, MonetizationOn } from '@mui/icons-material';
import { useSnackbar } from 'notistack';


// Librairies date
import { isAfter, isBefore, isWithinInterval } from 'date-fns';

// Hooks internes
import { useAuth } from '../hooks/useAuth';
import { useBookings } from '../hooks/useBookings';

// Composants internes
import { BookingWizard } from '../components/BookingWizard';
import { BookingCard } from '../components/BookingCard';
import { EditBookingDialog } from '../components/EditBookingDialog';
import { CreateGuestDialog } from '../components/CreateGuestDialog';
import { userService } from '../services/userService';

// Types
import type { Booking } from '../types/booking';
import type { Guest } from '../types/family';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { data: bookings = [] } = useBookings(user?.id);
  const [showWizard, setShowWizard] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [openGuestDialog, setOpenGuestDialog] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleCreateGuest = async (data: Omit<Guest, 'id' | 'created_at'>) => {
    const result = await userService.createGuestProfile(data);
    if (result.error) {
      enqueueSnackbar('Erreur lors de la création du participant', { variant: 'error' });
      return false;
    }
    enqueueSnackbar('Invité ajouté avec succès', { variant: 'success' });
    return true;
  };


  const today = new Date();
  const currentBooking = bookings.find(b => isWithinInterval(today, {
    start: new Date(b.start_date),
    end: new Date(b.end_date)
  }));

  const unpaidBookings = bookings
    .filter(b => b.status !== 'paid' && b.status !== 'cancelled' && isBefore(new Date(b.end_date), today))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const futureBookings = bookings
    .filter(b => isAfter(new Date(b.start_date), today))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());


  const total = bookings
  .filter(b => b.status !== 'cancelled')
  .reduce((sum, b) => sum + (b.total_cost ?? 0), 0);

  const paid = bookings.reduce((sum, b) => sum + (b.status === 'paid' ? (b.total_cost ?? 0) : 0), 0);
  
  const due = total - paid;

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Tableau de bord</Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems="flex-start"
      >
        {/* Partie principale */}
        <Box flex={1}>
          {currentBooking && (
            <Card sx={{ mb: 3, backgroundColor: '#e8f5e9' }}>
              <CardContent>
                <Typography variant="h6" color="success.main">Séjour en cours</Typography>
                <BookingCard booking={currentBooking} onEdit={(booking) => {
                    setBookingToEdit(booking);
                    setShowEditDialog(true);
                  }} />
              </CardContent>
            </Card>
          )}

          {unpaidBookings.length > 0 && (
            <Card sx={{ mb: 3, backgroundColor: '#ffebee' }}>
              <CardContent>
                <Typography variant="h6" color="error">Séjours à régler</Typography>
                {unpaidBookings.map(b => 
                  <BookingCard key={b.id} booking={b} onEdit={(booking) => {
                    setBookingToEdit(booking);
                    setShowEditDialog(true);
                  }} />
                )}
              </CardContent>
            </Card>
          )}

          {futureBookings.length > 0 && (
            <Card sx={{ mb: 3, backgroundColor: '#e3f2fd' }}>
              <CardContent>
                <Typography variant="h6" color="primary">Séjours à venir</Typography>
                {futureBookings.map(b => 
                  <BookingCard key={b.id} booking={b} onEdit={(booking) => {
                    setBookingToEdit(booking);
                    setShowEditDialog(true);
                  }} />
                )}
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Colonne droite : bouton + résumé financier */}
        <Stack spacing={2} alignItems="stretch" minWidth={250}>
          <Button 
            variant="outlined" 
            onClick={() => setOpenGuestDialog(true)}
            fullWidth
          >
            Ajouter un Guest
          </Button>

          <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 2, backgroundColor: '#f9f9f9', boxShadow: 2 }}>
            <Typography variant="h6" gutterBottom>Résumé financier</Typography>

            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <MonetizationOn color="success" />
              <Typography variant="body1">Total payé :</Typography>
              <Typography variant="h6" color="green">{paid} €</Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <MonetizationOn color="error" />
              <Typography variant="body1">Total à payer :</Typography>
              <Typography variant="h6" color="red">{due} €</Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              <MonetizationOn color="primary" />
              <Typography variant="body1">Total global :</Typography>
              <Typography variant="h6" color="#1976d2">{total} €</Typography>
            </Stack>
          </Box>
        </Stack>



      </Stack>

      <Tooltip title="Nouveau séjour">
        <Fab 
          color="primary" 
          sx={{ position: 'fixed', bottom: 32, right: 32 }} 
          onClick={() => {
            //console.log("Clic bouton + → ouverture wizard en mode création");
            setBookingToEdit(null);      // création = pas de séjour existant
            setShowWizard(true);         // affiche BookingWizard
          }}
        >
          <AddIcon />
        </Fab>
      </Tooltip>
        {/* Création d’un séjour */}
          <BookingWizard
            open={showWizard}
            onClose={() => {
              setShowWizard(false);
              setBookingToEdit(null);       // toujours reset après fermeture
            }}
          />

          <CreateGuestDialog
                  open={openGuestDialog}
                  onClose={() => setOpenGuestDialog(false)}
                  onSubmit={handleCreateGuest}
                />

          {/* Édition des participants d’un séjour existant */}
          {bookingToEdit && showEditDialog && user && (
            <EditBookingDialog
              open={true}
              booking={bookingToEdit}
              onClose={() => {
                setShowEditDialog(false);
                setBookingToEdit(null);     // reset après modification
              }}
            />
          )}

    </Box>
  );
};

