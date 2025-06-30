// src/utils/bookingUtils.ts

import type { Booking, PersonDetails, ArrivalTime, DepartureTime, SejourStatus } from '../types/booking';
import { supabase } from '../services/supabase';
import type { User } from '../types/family';

/**
 * Vérifie si une nouvelle réservation chevauche une réservation existante
 * pour le même utilisateur.
 */

const arrivalOrder = {
  morning: 1,
  afternoon: 2,
  evening: 3
};


export function hasOverlappingBooking(
  newStart: Date,
  newEnd: Date,
  userId: string,
  bookings: Booking[],
  excludeBookingId?: string,
  newArrivalTime?: 'morning' | 'afternoon' | 'evening',
  newDepartureTime?: 'morning' | 'afternoon' | 'evening'
): boolean {
  const arrivalOrder = {
    morning: 1,
    afternoon: 2,
    evening: 3
  };

  for (const b of bookings) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (b.user_id !== userId) continue;

    const bStart = new Date(b.start_date);
    const bEnd = new Date(b.end_date);

    // ✅ cas 1 : autre séjour finit le même jour, nous arrivons plus tard
    if (bEnd.getTime() === newStart.getTime()) {
      const endRank = arrivalOrder[b.departure_time as keyof typeof arrivalOrder];
      const startRank = arrivalOrder[newArrivalTime as keyof typeof arrivalOrder];

      if (startRank > endRank) {
        console.log(`🟢 OK : ${b.id} finit ${b.departure_time}, on arrive ${newArrivalTime}`);
        continue;
      }
    }

    // ✅ cas 2 : nous finissons et un autre séjour commence plus tard
    if (newEnd.getTime() === bStart.getTime()) {
      const newEndRank = arrivalOrder[newDepartureTime as keyof typeof arrivalOrder];
      const bStartRank = arrivalOrder[b.arrival_time as keyof typeof arrivalOrder];

      if (bStartRank > newEndRank) {
        console.log(`🟢 OK : on finit ${newDepartureTime}, ${b.id} arrive ${b.arrival_time}`);
        continue;
      }
    }

    const hasConflict = newStart <= bEnd && newEnd >= bStart;
    if (hasConflict) {
      console.warn(`⚠️ Conflit détecté entre le séjour en cours et ${b.id}`);
      return true;
    }
  }

  return false;
}


/**
 * Calcul des statistiques générales des réservations
 */
export function getBookingStats(bookings: Booking[]) {
  const total = bookings.length;
  const confirmed = bookings.filter(b => b.status === 'completed').length;
  const planned = bookings.filter(b => b.status === 'pending').length;
  const paid = bookings.filter(b => b.status === 'paid').length;
  const totalRevenue = bookings
    .filter(b => b.status === 'paid')
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

export const statusLabels: Record<SejourStatus, string> = {
  pending: 'Planifié',
  completed: 'Réalisé',
  paid: 'Payé',
  cancelled: 'Annulé',
};

export const getChipColor = (status: SejourStatus): "default" | "primary" | "success" | "warning" | "error" => {
  switch (status) {
    case 'pending': return 'primary';
    case 'completed': return 'warning';
    case 'paid': return 'success';
    case 'cancelled': return 'error';
    default: return 'default';
  }
};

export const getStatusLabel = (status: SejourStatus): string => {
  return statusLabels[status];
};

/**
 * Calcul du nombre de jours et de nuits selon les règles métier.
 */
export function calculateNightsAndDays(
  startDate: Date,
  endDate: Date,
  arrivalTime: ArrivalTime,
  departureTime: DepartureTime
): { nights: number; days: number } {
  
  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  let nights = diffDays;
  let days = 0;

  if (diffDays === 0) {
    nights = 0;
    days = 1;
    return { nights, days };
  }

  if (diffDays === 1 && arrivalTime === 'afternoon' && departureTime === 'morning') {
    nights = 1;
    days = 0;
    return { nights, days };
  }

  days = nights + 1;
  return { nights, days };
}

/**
 * Calcul complet du coût d'une réservation.
 */

export async function calculateBookingCost(
  persons: PersonDetails[]
): Promise<number> {
  const { data: pricingData, error } = await supabase
    .from('pricing_settings')
    .select('person_type, night_price, day_price');

  if (error || !pricingData) {
    console.error("Erreur chargement tarifs", error);
    throw new Error("Impossible de charger les tarifs");
  }

  const pricingMap: Record<string, { night_price: number; day_price: number }> = {};
  pricingData.forEach(p => {
    pricingMap[p.person_type] = {
      night_price: p.night_price,
      day_price: p.day_price,
    };
  });

  let total = 0;

  persons.forEach((person, index) => {
    const pricing = pricingMap[person.person_type];
    if (!pricing) {
      console.warn(`Tarif inconnu pour type ${person.person_type}`);
      return;
    }

    if (!person.arrivalDate || !person.departureDate || !person.arrivalTime || !person.departureTime) {
      console.warn(`Dates manquantes pour le participant ${index + 1}`);
      return;
    }

    const { nights, days } = calculateNightsAndDays(
      person.arrivalDate!,
      person.departureDate!,
      person.arrivalTime,
      person.departureTime
    );

    total += pricing.night_price * nights;
    total += pricing.day_price * days;
  });

  return total;
}


export function deducePersonType(user: User): string {
  if (user.birth_date) {
    const birthDate = new Date(user.birth_date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return 'enfant_famille';
    }
  }

  if (user.is_student) {
    return 'etudiant_famille';
  }

  return 'adulte_famille';
}