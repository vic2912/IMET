// src/types/booking.ts
export type ArrivalTime = 'morning' | 'afternoon' | 'evening';
export type DepartureTime = 'morning' | 'afternoon' | 'evening';
export type SejourStatus = 'planifié' | 'réalisé' | 'payé' | 'cancelled';

export interface PersonDetails {
  id: string;
  name: string;
  arrivalDate: Date;
  arrivalTime: ArrivalTime;
  departureDate: Date;
  departureTime: DepartureTime;
}

export interface ExtendedCreateBookingData {
  start_date: string;
  end_date: string;
  arrival_time: ArrivalTime;
  departure_time: DepartureTime;
  adults: number;
  children: number;
  booking_for_self: boolean;
  booking_for_name?: string;
  booking_for_email?: string;
  persons_details: PersonDetails[];
  comments?: string;
}

export interface Booking {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  arrival_time: ArrivalTime;
  departure_time: DepartureTime;
  adults: number;
  children: number;
  total_cost: number;
  status: SejourStatus;
  booking_for_self: boolean;
  booking_for_name?: string;
  booking_for_email?: string;
  persons_details: string; // JSON stringifié
  comments?: string;
  total_amount?: number;
  check_in_completed: boolean;
  check_out_completed: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export interface CreateBookingData {
  start_date: string;
  end_date: string;
  adults: number;
  children: number;
  comments?: string;
}

export interface UpdateBookingData {
  start_date?: string;
  end_date?: string;
  adults?: number;
  children?: number;
  status?: SejourStatus;
  comments?: string;
  check_in_completed?: boolean;
  check_out_completed?: boolean;
}

export interface BookingFormData {
  startDate: Date | null;
  endDate: Date | null;
  adults: number;
  children: number;
  comments: string;
}

export interface BookingStats {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  totalRevenue: number;
  totalNights: number;
  averageStay: number;
}