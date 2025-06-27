// src/types/admin.ts

export interface User {
  id: string;
  email: string;
  full_name: string;
  family_name?: string;
  is_admin: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PricingSettings {
  id?: string;
  night_price: number;
  day_price: number;
  max_capacity: number;
  currency: string;
  created_at?: string;
  updated_at?: string;
}

export interface UpdatePricingData {
  night_price?: number;
  day_price?: number;
  max_capacity?: number;
  currency?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalBookings: number;
  totalRevenue: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
