import React from 'react';
import { useBookings } from '../hooks/useBookings';
import { BookingCalendar } from '../components/BookingCalendar';

export const BookingsPage: React.FC = () => {
const { data: bookings = [], isLoading, error } = useBookings();

if (isLoading) return <div>Chargement...</div>;
if (error) return <div>Erreur : {error.message}</div>;

return <BookingCalendar bookings={bookings} />;

};
