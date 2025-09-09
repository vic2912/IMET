import { useQuery } from '@tanstack/react-query';
import { bookingService } from '../services/bookings';

export const useAdminStats = (year: number) => {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  return useQuery({
    queryKey: ['admin-stats', year],
    queryFn: async () => {
      const res = await bookingService.getByDateRange(start, end);
      return res.data || [];
    }
  });
};
