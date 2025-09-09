// src/hooks/useUpdateBookingStatus.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookings';
import type { Booking, SejourStatus } from '../types/booking';

type Scope =
  | { scope: 'user'; userId: string }
  | { scope: 'admin' }
  | { scope: 'all' };

export const useUpdateBookingStatus = (scope: Scope) => {
  const qc = useQueryClient();

  // Clés “ciblées” selon le scope.
  // Pour 'all', on ne met PAS ['bookings'] (clé fantôme) : on comptera sur patchEverywhere.
  const keysToTouch =
    scope.scope === 'user'
      ? ([['bookings', 'user', scope.userId]] as const)
      : scope.scope === 'admin'
      ? ([['bookings', 'admin']] as const)
      : ([] as const);

  // Patch utilitaire : applique un changement à TOUTES les listes qui commencent par ['bookings', ...]
  const patchEverywhere = (patch: (arr: Booking[]) => Booking[]) => {
    qc.setQueriesData<Booking[]>({ queryKey: ['bookings'], type: 'all' }, (old) => {
      // Si la query n'a pas encore de data, ne crée pas d'entrée vide.
      if (!Array.isArray(old)) return old;
      return patch(old);
    });
  };

  return useMutation<
    void,
    Error,
    { id: string; status: SejourStatus },
    { prev: Array<[readonly unknown[], Booking[] | undefined]> }
  >({
    mutationFn: async ({ id, status }) => {
      const { error } = await bookingService.updateStatus(id, status);
      if (error) throw new Error(error);
    },

    onMutate: async ({ id, status }) => {
      // Annuler les fetch en cours
      await Promise.all(keysToTouch.map((key) => qc.cancelQueries({ queryKey: key })));

      // Snapshot pour rollback
      const prev: Array<[readonly unknown[], Booking[] | undefined]> = keysToTouch.map((key) => [
        key,
        qc.getQueryData<Booking[]>(key),
      ]);

      // Patch optimiste ciblé par clé (référence stable si rien ne change)
      keysToTouch.forEach((key) => {
        qc.setQueryData<Booking[]>(key, (old) => {
          if (!Array.isArray(old)) return old;
          let found = false;
          const next = old.map((b) => {
            if (b.id === id) {
              found = true;
              return { ...b, status };
            }
            return b;
          });
          return found ? next : old;
        });
      });

      // Patch optimiste global (toutes variantes ['bookings', ...])
      patchEverywhere((arr) => {
        let found = false;
        const next = arr.map((b) => (b.id === id ? ((found = true), { ...b, status }) : b));
        return found ? next : arr;
      });

      return { prev };
    },

    onError: (_e, _v, ctx) => {
      // Rollback snapshots
      ctx?.prev.forEach(([key, snapshot]) => qc.setQueryData(key, snapshot));
    },

    onSettled: async () => {
      // Resynchro douce : toutes les queries actives sous ['bookings', ...]
      await qc.refetchQueries({ queryKey: ['bookings'], type: 'active' });
    },
  });
};
