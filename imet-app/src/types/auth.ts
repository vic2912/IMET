// src/types/auth.ts

import type { User as FamilyUser } from '../types/family';

export interface AuthUser extends FamilyUser {
  is_admin: boolean;
}

export type User = AuthUser;

export interface AuthFormData {
  email: string;
  password: string;
  fullName?: string;
  familyName?: string;
}

export type AuthMode = 'login' | 'signup';

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName: string;
  familyName?: string;
}
