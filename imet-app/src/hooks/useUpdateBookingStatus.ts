import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookings';
import type { SejourStatus } from '../types/booking';

export const useUpdateBookingStatus = (userId: string) => {
    const queryClient = useQueryClient();
    
    return useMutation<null, Error, { id: string; status: SejourStatus }>({
    mutationFn: async ({ id, status }) => {
        console.log('🚀 Mutation appelée avec id:', id, 'status:', status);
        const { error } = await bookingService.updateStatus(id, status);
        if (error) throw new Error(error);
        return null;
    },
    onSuccess: () => {
        console.log('✅ Mutation succès, userId =', userId);
        //queryClient.invalidateQueries({ queryKey: ['bookings', userId] });
        queryClient.invalidateQueries({ queryKey: ['bookings'] });

        
    }
    });

};


