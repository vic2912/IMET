// src/types/index.ts
// Point d'entrée pour tous les types

// Import des types pour les constantes
import type { SejourStatus} from './booking';
import type { ExpenseStatus, ExpenseCategory } from './expense';
export * from './booking';
export * from './notification';

// Auth types
export type {
  User,
  AuthFormData,
  AuthMode,
  AuthState,
  LoginCredentials,
  SignupData
} from './auth';

export * from './admin';

// Booking types
export type {
  Booking,
  SejourStatus,
  CreateBookingData,
  UpdateBookingData,
  BookingFormData,
  BookingStats
} from './booking';

// Expense types
export type {
  Expense,
  ExpenseStatus,
  ExpenseCategory,
  CreateExpenseData,
  UpdateExpenseData,
  ExpenseFormData,
  ExpenseStats
} from './expense';

// Notification types
export type {
  Notification,
  NotificationType,
  NotificationChannel,
  EmailFrequency,
  NotificationPriority,
  CreateNotificationData,
  NotificationPreferences,
  PushSubscription
} from './notification';

// Common types
export type {
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  NotificationSeverity,
  AppSettings,
  SelectOption,
  DateRange,
  LoadingState,
  FormFieldError,
  FormState
} from './common';




// Constantes utiles
export const BOOKING_STATUSES: SejourStatus[] = ['planifié', 'réalisé', 'payé'];
export const EXPENSE_STATUSES: ExpenseStatus[] = ['pending', 'approved', 'rejected'];
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Entretien',
  'Réparations', 
  'Courses',
  'Piscine',
  'Jardin',
  'Électricité',
  'Eau',
  'Chauffage',
  'Internet',
  'Assurance',
  'Taxes',
  'Autre'
];

// Export des templates de notifications
export { NOTIFICATION_TEMPLATES } from './notification';