import { useQuery } from '@tanstack/react-query';
import { bookingService } from '../services/bookings';
import type { Booking } from '../types/booking';

/**
 * Hook de lecture des réservations
 * - Si userId fourni : bookings filtrés par user
 * - Sinon : toutes les réservations
 */
export const useBookings = (userId?: string) => {
  return useQuery<Booking[], Error>({
    queryKey: ['bookings', userId],
    queryFn: () => {
      if (userId) return bookingService.getByUserId(userId);
      return bookingService.getAll();
    }
  });
};



