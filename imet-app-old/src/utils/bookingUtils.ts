import { Booking } from '../types/booking';

/**
 * Vérifie si une nouvelle réservation chevauche une réservation existante
 * pour le même utilisateur.
 *
 * @param newStart - Date de début de la nouvelle réservation
 * @param newEnd - Date de fin de la nouvelle réservation
 * @param userId - Identifiant de l'utilisateur concerné
 * @param bookings - Liste des réservations existantes
 * @returns true s'il y a un chevauchement, false sinon
 */
export function hasOverlappingBooking(
  newStart: Date,
  newEnd: Date,
  userId: string,
  bookings: Booking[]
): boolean {
  return bookings.some((booking) => {
    if (booking.user_id !== userId) return false;

    const existingStart = new Date(booking.start_date);
    const existingEnd = new Date(booking.end_date);

    return newStart <= existingEnd && newEnd >= existingStart;
  });
}

/**
 * Calcul des statistiques générales des réservations
 */
export function getBookingStats(bookings: Booking[]) {
  const total = bookings.length;
  const confirmed = bookings.filter(b => b.status === 'réalisé').length;
  const planned = bookings.filter(b => b.status === 'planifié').length;
  const paid = bookings.filter(b => b.status === 'payé').length;
  const totalRevenue = bookings
    .filter(b => b.status === 'payé')
    .reduce((sum, b) => sum + (b.total_cost || 0), 0);

  return { total, confirmed, planned, paid, totalRevenue };
}

/**
 * Récupère les réservations à venir
 */
export function getUpcomingBookings(bookings: Booking[], limit?: number): Booking[] {
  const now = new Date();

  const upcoming = bookings
    .filter(b => new Date(b.start_date) > now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  return limit ? upcoming.slice(0, limit) : upcoming;
}

/**
 * Filtre les réservations par statut
 */
export function getBookingsByStatus(bookings: Booking[], status: string): Booking[] {
  return bookings.filter(b => b.status === status);
}
