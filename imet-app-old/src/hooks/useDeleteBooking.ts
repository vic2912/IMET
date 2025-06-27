import { useMutation, useQueryClient } from 'react-query';
import { bookingsService } from '../services/bookingsService';

/**
 * Hook pour supprimer une réservation
 */
export const useDeleteBooking = () => {
  const queryClient = useQueryClient();

  return useMutation<
    void,   // la suppression ne retourne rien
    Error,  // type d'erreur
    string  // l'identifiant à supprimer
  >(
    (id: string) => bookingsService.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('bookings');
      }
    }
  );
};
