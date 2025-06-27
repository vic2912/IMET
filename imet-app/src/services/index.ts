// src/services/index.ts
// Point d'entrée pour tous les services

export { supabase, executeQuery, handleSupabaseError } from './supabase';
export { authService } from './auth';
export { bookingService } from './bookings';
export { expenseService } from './expenses';
export { adminService } from './admin';
export { NotificationService } from './notificationService';

// Types des services
export type {
  SupabaseError,
  SupabaseResponse
} from './supabase';