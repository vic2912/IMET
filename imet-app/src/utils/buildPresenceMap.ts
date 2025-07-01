// utils/buildPresenceMap.ts

import { parse, parseISO, format, isSameDay, eachDayOfInterval } from 'date-fns';
import type { Booking, PersonDetails, DailyPresence } from '../types/booking';

export function toDateSafe(input: string | Date | null): Date {
  if (!input) {
    throw new Error('Date invalide : null ou undefined');
  }
  if (input instanceof Date) return input;
  if (typeof input === 'string' && input.includes('/')) {
    return parse(input, 'dd/MM/yyyy', new Date());
  }
  return parseISO(input);
}

export function buildPresenceMap(bookings: Booking[]): Record<string, DailyPresence> {
  const map: Record<string, DailyPresence> = {};

  bookings
    .filter(b => b.status !== 'cancelled')
    .forEach((booking) => {
      const start = parseISO(booking.start_date);
      const end = parseISO(booking.end_date);
      const arrivalTime = booking.arrival_time;
      const departureTime = booking.departure_time;

      const persons: PersonDetails[] = typeof booking.persons_details === 'string'
        ? JSON.parse(booking.persons_details)
        : booking.persons_details || [];

      eachDayOfInterval({ start, end }).forEach((day) => {
        const key = format(day, 'yyyy-MM-dd');
        if (!map[key]) {
          map[key] = {
            date: key,
            morning: [],
            lunch: [],
            dinner: [],
            nuit: [],
            maxPeople: 0,
          };
        }

        persons.forEach((p) => {
            const a = toDateSafe(p.arrivalDate);
            const d = toDateSafe(p.departureDate);
            a.setHours(0, 0, 0, 0);
            d.setHours(0, 0, 0, 0);
            day.setHours(0, 0, 0, 0);
            
          const isArrivalDay = isSameDay(day, a);
          const isDepartureDay = isSameDay(day, d);

          const presentMorning =
            (day > a && day < d) ||
            (day > a && isDepartureDay);

          const presentLunch =
            (day > a && day < d) ||
            (isArrivalDay && arrivalTime === 'morning') ||
            (isDepartureDay && departureTime !== 'morning');

          const presentDinner =
            (day > a && day < d) ||
            (isArrivalDay && arrivalTime !== 'evening') ||
            (isDepartureDay && departureTime === 'evening');
 
            const presentNuit = day >= a && day < d;

            console.log(
                `🛌 ${day} ${p.name} ${presentNuit} | arrival: ${a} | departure: ${d}`
            );


          if (presentMorning) map[key].morning.push(p);
          if (presentLunch) map[key].lunch.push(p);
          if (presentDinner) map[key].dinner.push(p);
          if (presentNuit) map[key].nuit.push(p);
        });

        map[key].maxPeople = Math.max(
          map[key].morning.length,
          map[key].lunch.length,
          map[key].dinner.length
        );
      });
    });

  return map;
}