// src/types/booking.ts
export type ArrivalTime = 'morning' | 'afternoon' | 'evening';
export type DepartureTime = 'morning' | 'afternoon' | 'evening';
export type SejourStatus = 'pending' | 'completed' | 'paid' | 'cancelled';

export interface PersonDetails {
  id?: string;
  name: string;
  arrivalDate: Date | null;
  arrivalTime: ArrivalTime;
  departureDate: Date | null;
  departureTime: DepartureTime;
  person_type: string;
  allergies?: string;
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
  status: SejourStatus;
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
  persons_details: PersonDetailsForServer[];
  comments?: string;
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
  total_cost?: number;
  persons_details?: PersonDetails[];
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

export type PersonDetailsForServer = Omit<PersonDetails, 'arrivalDate' | 'departureDate'> & {
  arrivalDate: string | null;
  departureDate: string | null;
};

export type ExtendedCreateBookingDataForServer = Omit<ExtendedCreateBookingData, 'persons_details'> & {
  persons_details: PersonDetailsForServer[];
};
