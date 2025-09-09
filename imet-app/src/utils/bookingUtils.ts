// src/utils/bookingUtils.ts

import type { Booking, PersonDetails, ArrivalTime, DepartureTime, SejourStatus } from '../types/booking';
import { supabase } from '../services/supabase';
import type { User } from '../types/family';
import { addDays, parseISO, differenceInCalendarDays, isSameDay, format } from 'date-fns';

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * Vérifie si une nouvelle réservation chevauche une réservation existante
 * pour le même utilisateur.
 */

export function hasOverlappingBooking(
  newStart: Date,
  newEnd: Date,
  userId: string,
  bookings: Booking[],
  excludeBookingId?: string,
  newArrivalTime?: ArrivalTime,
  newDepartureTime?: DepartureTime
): boolean {
  // Rang sûr avec valeur par défaut 'afternoon' si non fourni
  const timeRank = (t?: ArrivalTime | DepartureTime) =>
    ({ morning: 1, afternoon: 2, evening: 3 }[t ?? 'afternoon']);

  for (const b of bookings) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (b.user_id !== userId) continue;

    const bStart = new Date(b.start_date);
    const bEnd = new Date(b.end_date);

    // ✅ cas 1 : autre séjour finit le même jour, nous arrivons plus tard
    if (isSameDay(bEnd, newStart)) {
      const endRank = timeRank(b.departure_time as DepartureTime);
      const startRank = timeRank(newArrivalTime);
      if (startRank > endRank) {
        // ex: il finit "morning", on arrive "afternoon" → OK
        continue;
      }
    }

    // ✅ cas 2 : nous finissons et un autre séjour commence plus tard
    if (isSameDay(newEnd, bStart)) {
      const newEndRank = timeRank(newDepartureTime);
      const bStartRank = timeRank(b.arrival_time as ArrivalTime);
      if (bStartRank > newEndRank) {
        // ex: on finit "morning", il arrive "afternoon" → OK
        continue;
      }
    }

    // Test d'intersection (inclusif) sur les dates calendaires
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
  
  // 1) Nuits = nb de changements de date
  const nights = differenceInCalendarDays(endDate, startDate);
  
  // 2) Journées = taille de l’ensemble des jours de présence
  const daysSet = getPresenceDayList(
    format(startDate, 'yyyy-MM-dd'),
    arrivalTime,
    format(endDate, 'yyyy-MM-dd'),
    departureTime
  );

  const days = daysSet.size;

  return { nights, days };
}
//Fonction pour appliquer le discount sur le prix

export function applyDiscount(base: number, rate: number): { net: number; discountAmount: number } {
  const r = Math.min(Math.max(rate || 0, 0), 1); // borne 0..1
  const discountAmount = Math.round(base * r);
  const net = Math.max(0, Math.round(base - discountAmount));
  return { net, discountAmount };
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
    if (!person.arrivalDate || !person.departureDate || !person.arrivalTime || !person.departureTime) {
      console.warn(`Dates manquantes pour le participant ${index + 1}`);
      return;
    }
    // Règle métier : Enfants et Étudiants = 0 €
    const isChild = person.person_type?.startsWith('enfant');
    const isStudent = person.person_type === 'etudiant_famille';
    const base = pricingMap[person.person_type];
    const nightPrice = (isChild || isStudent) ? 0 : (base?.night_price ?? 0);
    const dayPrice   = (isChild || isStudent) ? 0 : (base?.day_price ?? 0);

    const { nights, days } = calculateNightsAndDays(
      person.arrivalDate!,
      person.departureDate!,
      person.arrivalTime,
      person.departureTime
    );
    total += nightPrice * nights;
    total += dayPrice * days;
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


// Fonction utilisé dans les statistiques globales, pour définir si l'utilisateur ou un invité dort des nuits supplémentaires. 

export function getPresenceDayList(
  arrivalDate: string,
  arrivalTime: ArrivalTime,
  departureDate: string,
  departureTime: DepartureTime
): Set<string> {
  const start = parseISO(arrivalDate);
  const end = parseISO(departureDate);
  const days = new Set<string>();

  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // On ne compte pas le jour d’arrivée si "evening"
  const startOffset = arrivalTime === 'evening' ? 1 : 0;

  // On compte le jour de départ si présent l’après-midi ou soir
  const includeDeparture = departureTime !== 'morning';

  for (let i = startOffset; i < diff; i++) {
      const d = addDays(start, i);
      days.add(dayKey(d));
    }
    if (arrivalTime !== 'evening') {
      days.add(dayKey(start));
    }
    if (includeDeparture) {
      days.add(dayKey(end));
    }
  return days;
}

export function getUniqueNightList(
  arrivalDate: string | null,
  departureDate: string | null
): Set<string> {
  const result = new Set<string>();
  if (!arrivalDate || !departureDate) return result;

  const start = parseISO(arrivalDate);
  const end = parseISO(departureDate);

  const diff = differenceInCalendarDays(end, start); // Ne pas inclure la nuit de départ

  for (let i = 0; i < diff; i++) {
    const d = addDays(start, i);
    result.add(dayKey(d));
  }

  return result;
}


// Fonctions pour comprendre le prix payé par chaque participant. 
export type PriceBreakdownRow = {
  name: string;
  person_type: string;
  nights: number;
  days: number;
  night_price: number;
  day_price: number;
  subtotal_nights: number;
  subtotal_days: number;
  total: number;
  arrivalDate: string;
  departureDate: string;
  arrivalTime: ArrivalTime;
  departureTime: DepartureTime;
};

/** Détail par participant : nuits/jours * tarifs + total global */
export async function calculateBookingBreakdown(persons: PersonDetails[]): Promise<{ rows: PriceBreakdownRow[]; total: number }> {
  const { data: pricingData, error } = await supabase
    .from('pricing_settings')
    .select('person_type, night_price, day_price');

  if (error || !pricingData) {
    throw new Error("Impossible de charger les tarifs");
  }

  const pricingMap: Record<string, { night_price: number; day_price: number }> = {};
  pricingData.forEach(p => (pricingMap[p.person_type] = { night_price: p.night_price, day_price: p.day_price }));

  const rows: PriceBreakdownRow[] = [];
  let total = 0;

  persons.forEach((p) => {
    if (!p.arrivalDate || !p.departureDate || !p.arrivalTime || !p.departureTime) return;
    const isChild = p.person_type?.startsWith('enfant');
    const isStudent = p.person_type === 'etudiant_famille';
    const base = pricingMap[p.person_type];
    const night_price = (isChild || isStudent) ? 0 : (base?.night_price ?? 0);
    const day_price   = (isChild || isStudent) ? 0 : (base?.day_price ?? 0);

    const aDate = (p.arrivalDate instanceof Date) ? p.arrivalDate : new Date(p.arrivalDate as any);
    const dDate = (p.departureDate instanceof Date) ? p.departureDate : new Date(p.departureDate as any);
    const { nights, days } = calculateNightsAndDays(aDate, dDate, p.arrivalTime, p.departureTime);

    const subtotal_nights = nights * night_price;
    const subtotal_days = days * day_price;
    const lineTotal = subtotal_nights + subtotal_days;

    rows.push({
      name: p.name,
      person_type: p.person_type,
      nights,
      days,
      night_price,
      day_price,
      subtotal_nights,
      subtotal_days,
      total: lineTotal,
      arrivalDate: format(aDate, 'yyyy-MM-dd'),
      departureDate: format(dDate, 'yyyy-MM-dd'),
      arrivalTime: p.arrivalTime,
      departureTime: p.departureTime,
    });
    total += lineTotal;
  });

  return { rows, total };
}


