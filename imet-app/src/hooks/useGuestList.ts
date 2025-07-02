import { useQuery } from '@tanstack/react-query';
import { userService } from '../services/userService';
import type { Guest } from '../types/family';

export const useGuestList = () => {
  return useQuery<Guest[], string>({
    queryKey: ['guests'],
    queryFn: async () => {
      const { data, error } = await userService.getGuests();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });
};
