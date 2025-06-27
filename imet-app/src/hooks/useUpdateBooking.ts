import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookings';
import type { Booking, UpdateBookingData } from '../types/booking';

/**
 * Hook pour mettre à jour une réservation existante
 */
export const useUpdateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation<Booking, Error, { id: string; data: UpdateBookingData }>({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await bookingService.update(id, data);
      if (error || !updated) throw new Error(error || 'Échec de la mise à jour.');
      return updated;
    },
    onSuccess: (updatedBooking) => {
      queryClient.invalidateQueries({
        queryKey: ['bookings', updatedBooking.user_id]
      });
    }
  });
};
