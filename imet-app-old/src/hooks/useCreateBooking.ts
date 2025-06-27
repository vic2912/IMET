import { useMutation, useQueryClient } from 'react-query';
import { bookingsService } from '../services/bookingsService';
import { ExtendedCreateBookingData, Booking } from '../types/booking';

/**
 * Hook pour créer une nouvelle réservation
 */
export const useCreateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation<
    Booking, // ce que retourne le serveur (Booking créé)
    Error,   // type d'erreur
    { userId: string; data: ExtendedCreateBookingData } // données envoyées
  >(
    ({ userId, data }) => bookingsService.create(userId, data),
    {
      onSuccess: () => {
        // Invalide le cache des bookings après création => auto-refresh
        queryClient.invalidateQueries('bookings');
      }
    }
  );
};
