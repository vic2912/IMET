import { useQuery } from 'react-query';
import { bookingsService } from '../services/bookingsService';
import { Booking } from '../types/booking';

/**
 * Hook de lecture des réservations
 * - Si userId fourni : bookings filtrés par user
 * - Sinon : toutes les réservations
 */
export const useBookings = (userId?: string) => {
  return useQuery<Booking[], Error>(['bookings', userId], () => {
    if (userId) {
      return bookingsService.getByUserId(userId);
    }
    return bookingsService.getAll();
  });
};
