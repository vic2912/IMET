// src/types/index.ts
// Point d'entrée unique pour tous les types

export * from './auth';
export * from './booking';
export * from './expense';
export * from './notification';
export * from './admin';
export * from './common';
export * from './family';

// Constantes utiles
import type { SejourStatus } from './booking';
import type { ExpenseStatus, ExpenseCategory } from './expense';

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
