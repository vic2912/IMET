// src/components/BookingCard.tsx

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Box
} from '@mui/material';
import { format, parseISO } from 'date-fns';
import { Booking } from '../types/booking';

interface BookingCardProps {
  booking: Booking;
  onClick?: () => void;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onClick }) => {
  const {
    start_date,
    end_date,
    adults,
    children,
    status,
    booking_for_self,
    booking_for_name
  } = booking;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Planifié': return 'info';
      case 'Réalisé': return 'default';
      case 'Payé': return 'success';
      default: return 'default';
    }
  };

  return (
    <Card variant="outlined" onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default' }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="subtitle2" component="div">
            {booking_for_self ? 'Pour moi' : `Pour ${booking_for_name}`}
          </Typography>

          <Box>
            <Typography variant="body2" component="div">
              Du {format(parseISO(start_date), 'dd/MM/yyyy')} au {format(parseISO(end_date), 'dd/MM/yyyy')}
            </Typography>
            <Typography variant="body2" component="div">
              {adults} adulte(s) / {children} enfant(s)
            </Typography>
          </Box>

          <Box>
            <Chip label={status} color={getStatusColor(status)} size="small" />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};
