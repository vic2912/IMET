// src/hooks/useUpdateBooking.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookings';
import type { Booking, UpdateBookingData } from '../types/booking';

type Scope =
  | { scope: 'user'; userId: string }
  | { scope: 'admin' }
  | { scope: 'all' };

const replaceById = (list: Booking[], updated: Booking) => {
  let changed = false;
  const next = list.map(b => {
    if (b.id === updated.id) {
      changed = true;
      return { ...b, ...updated };
    }
    return b;
  });
  return changed ? next : list;
};

export const useUpdateBooking = (scope: Scope) => {
  const qc = useQueryClient();

  // Les clés qu'on doit tenir à jour selon le scope
  const keysToTouch =
    scope.scope === 'user'
      ? [['bookings', 'user', scope.userId] as const,]
      : scope.scope === 'admin'
      ? [['bookings', 'admin'] as const,]
      : [];

  const patchEverywhere = (patch: (arr: Booking[]) => Booking[]) => {
    qc.setQueriesData<Booking[]>({ queryKey: ['bookings'], type: 'all' }, (old) => {
      if (!Array.isArray(old)) return old;
      return patch(old);
    });
  };

  return useMutation<Booking, Error, { id: string; data: UpdateBookingData }, { prev: Array<[readonly unknown[], Booking[] | undefined]> }>({
    mutationFn: async ({ id, data }) => {
      const { data: updated, error } = await bookingService.update(id, data);
      if (error || !updated) throw new Error(error ?? 'Échec de la mise à jour.');
      return updated;
    },

    // ✅ Optimistic update
    onMutate: async ({ id, data }) => {
      // Annule les refetch en cours pour ces clés
      await Promise.all(keysToTouch.map(key => qc.cancelQueries({ queryKey: key })));

      // Snapshot des listes pour rollback
      const prev: Array<[readonly unknown[], Booking[] | undefined]> = keysToTouch.map(key => {
        const snapshot = qc.getQueryData<Booking[]>(key);
        return [key, snapshot];
      });

      keysToTouch.forEach(key => {
        qc.setQueryData<Booking[]>(key, old => {
          if (!Array.isArray(old)) return old ?? []; // TData doit rester un tableau
              let found = false;
          const next = old.map(b => {
            if (b.id === id) {
              found = true;
              return { ...b, ...data } as Booking;
            }
            return b;
          });
          return found ? next : old; // si rien n’a changé, on garde la même ref
        });
      });
      // Patch global toutes variantes
      patchEverywhere(arr => arr.map(b => (b.id === id ? { ...b, ...data } as Booking : b)));


      return { prev };
    },

    // ✅ Si erreur → rollback
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      ctx.prev.forEach(([key, snapshot]) => {
        qc.setQueryData(key, snapshot);
      });
    },

    // ✅ Succès → on remplace par la version serveur (si différent)
    onSuccess: (updated) => {
      keysToTouch.forEach(key => {
        qc.setQueryData<Booking[]>(key, old => replaceById(old ?? [], updated));
      });
      patchEverywhere(arr => replaceById(arr, updated));
    },

    // ✅ Et derrière un refetch léger pour se resynchroniser
    onSettled: async () => {
      await qc.refetchQueries({ queryKey: ['bookings'], type: 'active' });
    },
  });
};
