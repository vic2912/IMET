// src/hooks/useBookings.ts
import { useQuery } from '@tanstack/react-query';
import { bookingService } from '../services/bookings';
import type { Booking } from '../types/booking';

/**
 * Hook user-scopé : NE FETCH PAS tant que userId n'est pas fourni.
 * -> Supprime le "flash" des réservations de tout le monde.
 */
export const useBookings = (userId?: string) => {
  return useQuery<Booking[], Error>({
    queryKey: ['bookings', 'user', userId ?? 'unknown'],
    enabled: !!userId,                 // ✅ attend que userId soit connu
    placeholderData: [],               // ✅ pas de recyclage visuel
    staleTime: 30_000,                 // confort
    refetchOnWindowFocus: false,       // optionnel
    queryFn: () => bookingService.getByUserId(userId as string),
  });
};

/**
 * Hook Admin : charge TOUTES les réservations.
 * À utiliser UNIQUEMENT sur l'interface Admin.
 */
export const useAdminBookings = () => {
  return useQuery<Booking[], Error>({
    queryKey: ['bookings', 'admin'],
    placeholderData: [],               // pas de flash non plus côté Admin
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: () => bookingService.getAll(),
  });
};
