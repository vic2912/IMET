//src/hooks/useCreateBooking.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookings';
import type { ExtendedCreateBookingDataForServer, Booking } from '../types/booking';

/**
 * Hook pour créer une nouvelle réservation
 */
export const useCreateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation<Booking, Error, { userId: string; data: ExtendedCreateBookingDataForServer }>({
    mutationFn: ({ userId, data }) => {
      console.log("Mutation envoyée à bookingService:", userId, data);
      console.log("Type de bookingService :", bookingService);
      return bookingService.create(userId, data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', variables.userId] });
    }
  });
};

