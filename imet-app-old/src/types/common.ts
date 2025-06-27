// src/types/common.ts

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginationParams {
  page: number;
  limit: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id?: string;
  message: string;
  severity: NotificationSeverity;
  open: boolean;
  autoHideDuration?: number;
}

export interface AppSettings {
  pricing_night_rate: number;
  pricing_day_rate: number;
  pricing_children_free: boolean;
  house_max_capacity: number;
  house_max_rooms: number;
  heating_supplement: number;
  exclusive_weekend_rate: number;
  annual_subscription: number;
}

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface LoadingState {
  loading: boolean;
  error?: string;
}

// Utilitaires pour les formulaires
export interface FormFieldError {
  field: string;
  message: string;
}

export interface FormState<T> {
  data: T;
  errors: FormFieldError[];
  loading: boolean;
  touched: Record<string, boolean>;
}