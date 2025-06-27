import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsService } from '../services/bookingsService';

/**
 * Hook pour supprimer une réservation
 */
export const useDeleteBooking = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id: string) => bookingsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    }
  });
};

