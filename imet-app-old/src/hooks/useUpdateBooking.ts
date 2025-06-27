import { useMutation, useQueryClient } from 'react-query';
import { bookingsService } from '../services/bookingsService';
import { Booking, UpdateBookingData } from '../types/booking';

/**
 * Hook pour mettre à jour une réservation existante
 */
export const useUpdateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation<
    Booking, // ce que retourne le serveur après update
    Error,   // type d'erreur
    { id: string; data: UpdateBookingData } // données envoyées
  >(
    ({ id, data }) => bookingsService.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('bookings');
      }
    }
  );
};
