import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookings';
import type { SejourStatus } from '../types/booking';

export const useUpdateBookingStatus = () => {
    const queryClient = useQueryClient();
    
    return useMutation<null, Error, { id: string; status: SejourStatus }>({
    mutationFn: async ({ id, status }) => {
        const { error } = await bookingService.updateStatus(id, status);
        if (error) throw new Error(error);
        return null;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
    }
    });

};


